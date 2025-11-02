import { promises as fs } from 'fs';
import path from 'path';
import selfsigned from 'selfsigned';
import type { Logger } from 'pino';

interface CertificatePair {
  key: string;
  cert: string;
}

const cacheDir = path.resolve(process.cwd(), '.cache', 'https');
const devKeyPath = path.join(cacheDir, 'dev-key.pem');
const devCertPath = path.join(cacheDir, 'dev-cert.pem');

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readPair(keyPath: string, certPath: string): Promise<CertificatePair> {
  const [key, cert] = await Promise.all([fs.readFile(keyPath, 'utf8'), fs.readFile(certPath, 'utf8')]);
  return { key, cert };
}

async function loadFromEnv(logger?: Logger): Promise<CertificatePair | undefined> {
  const keyPath = process.env.SSL_KEY_PATH;
  const certPath = process.env.SSL_CERT_PATH;
  if (!keyPath || !certPath) {
    return undefined;
  }
  try {
    const pair = await readPair(keyPath, certPath);
    logger?.info?.({ keyPath, certPath }, 'Loaded SSL certificate from environment paths');
    return pair;
  } catch (error) {
    logger?.error?.({ error, keyPath, certPath }, 'Failed to read SSL certificate files defined via environment variables');
    throw error;
  }
}

async function loadCached(logger?: Logger): Promise<CertificatePair | undefined> {
  try {
    const pair = await readPair(devKeyPath, devCertPath);
    logger?.debug?.({ devKeyPath, devCertPath }, 'Loaded cached self-signed certificate');
    return pair;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger?.warn?.({ error }, 'Could not load cached certificate, generating a new one');
    }
    return undefined;
  }
}

async function generateSelfSigned(logger?: Logger): Promise<CertificatePair> {
  await ensureDir(cacheDir);
  const attributes = [{ name: 'commonName', value: 'trackeovrconia.local' }];
  const { private: key, cert } = selfsigned.generate(attributes, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
  });
  await Promise.all([fs.writeFile(devKeyPath, key), fs.writeFile(devCertPath, cert)]);
  logger?.info?.({ devKeyPath, devCertPath }, 'Generated new self-signed development certificate');
  return { key, cert };
}

export async function resolveCertificate(logger?: Logger): Promise<CertificatePair> {
  const envPair = await loadFromEnv(logger);
  if (envPair) {
    return envPair;
  }
  const cached = await loadCached(logger);
  if (cached) {
    return cached;
  }
  return generateSelfSigned(logger);
}
