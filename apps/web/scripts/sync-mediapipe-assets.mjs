import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { createWriteStream } from 'fs';
import https from 'https';
import { createHash } from 'crypto';

const scriptPath = fileURLToPath(import.meta.url);
const here = dirname(scriptPath);
const appRoot = resolve(here, '..');
const publicModelsDir = resolve(appRoot, 'public', 'models');
const KEEP_FILES = new Set(['.gitignore', 'README.md']);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyFileSafe(src, dest, logger) {
  try {
    await ensureDir(dirname(dest));
    await fs.copyFile(src, dest);
    logger?.info?.(`[mediapipe] Copiado ${src} -> ${dest}`) ?? console.log(`[mediapipe] Copiado ${src} -> ${dest}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger?.warn?.(`[mediapipe] No se encontró el archivo requerido: ${src}`) ??
        console.warn(`[mediapipe] No se encontró el archivo requerido: ${src}`);
    } else {
      throw error;
    }
  }
}

function downloadFile(url, dest) {
  return new Promise((resolveDownload, rejectDownload) => {
    const request = https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        rejectDownload(new Error(`Fallo al descargar ${url}: ${response.statusCode}`));
        response.resume();
        return;
      }
      const fileStream = createWriteStream(dest);
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(resolveDownload);
      });
      fileStream.on('error', (error) => {
        fileStream.close(() => rejectDownload(error));
      });
    });

    request.on('error', rejectDownload);
  });
}

async function verifyChecksum(filePath, expectedSha256) {
  if (!expectedSha256) return true;
  try {
    const file = await fs.readFile(filePath);
    const hash = createHash('sha256').update(file).digest('hex');
    return hash === expectedSha256.toLowerCase();
  } catch (_error) {
    return false;
  }
}

async function downloadWithVerification(url, dest, expectedSha256, logger, optional) {
  const tempPath = `${dest}.download`;
  await ensureDir(dirname(dest));
  try {
    await downloadFile(url, tempPath);
    if (!(await verifyChecksum(tempPath, expectedSha256))) {
      throw new Error('La suma SHA-256 no coincide.');
    }
    await fs.rename(tempPath, dest);
    logger?.info?.(`[mediapipe] Descargado ${url} -> ${dest}`) ?? console.log(`[mediapipe] Descargado ${url} -> ${dest}`);
    return true;
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    const reason = error instanceof Error ? error.message : String(error);
    if (optional) {
      logger?.warn?.(`[mediapipe] Descarga opcional fallida para ${url}: ${reason}`) ??
        console.warn(`[mediapipe] Descarga opcional fallida para ${url}: ${reason}`);
    } else {
      logger?.warn?.(`[mediapipe] Descarga obligatoria fallida para ${url}: ${reason}`) ??
        console.warn(`[mediapipe] Descarga obligatoria fallida para ${url}: ${reason}`);
    }
    return false;
  }
}

async function copyDirectoryContents(srcDir, destDir, logger) {
  let entries;
  try {
    entries = await fs.readdir(srcDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger?.warn?.(`[mediapipe] Carpeta no encontrada: ${srcDir}`) ?? console.warn(`[mediapipe] Carpeta no encontrada: ${srcDir}`);
      return;
    }
    throw error;
  }

  await ensureDir(destDir);

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryContents(srcPath, destPath, logger);
    } else if (entry.isFile()) {
      await copyFileSafe(srcPath, destPath, logger);
    }
  }
}

export async function syncMediaPipeAssets(logger = console) {
  const pkgDir = resolve(appRoot, 'node_modules', '@mediapipe', 'tasks-vision');
  try {
    await fs.access(pkgDir);
  } catch (_error) {
    logger?.warn?.('[mediapipe] Paquete @mediapipe/tasks-vision no instalado. Omitiendo copia de assets.');
    return;
  }
  const wasmDir = join(pkgDir, 'wasm');
  const poseCandidates = [
    join(pkgDir, 'pose_landmarker_full.task'),
    join(pkgDir, 'pose_landmarker', 'pose_landmarker_full', 'float16', 'latest', 'pose_landmarker_full.task'),
  ];
  const poseDest = join(publicModelsDir, 'pose_landmarker_full.task');
  const poseCdnUrl =
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';

  await ensureDir(publicModelsDir);
  await copyDirectoryContents(wasmDir, publicModelsDir, logger);
  const assetPlan = [
    {
      name: 'pose_landmarker_full.task',
      destination: poseDest,
      candidates: poseCandidates,
      download: {
        url: poseCdnUrl,
        sha256: '4eaa5eb7a98365221087693fcc286334cf0858e2eb6e15b506aa4a7ecdcec4ad',
      },
    },
    {
      name: 'rife-lite.onnx',
      destination: join(publicModelsDir, 'rife-lite.onnx'),
      download: {
        url: 'https://github.com/PINTO0309/PINTO_model_zoo/raw/main/109_RIFE/01_float32/rife.onnx',
        sha256: '69b06c535eab45004243e9897d985b88e8deef06b9e211cd53a31318b040f468',
      },
    },
    {
      name: 'esrgan-lite.onnx',
      destination: join(publicModelsDir, 'esrgan-lite.onnx'),
      optional: true,
      download: {
        url: 'https://github.com/microsoft/onnxruntime-inference-examples/raw/main/js/super-resolution/model.onnx',
        sha256: 'cbcf9a0bb63e1c3ce5df8bdc9ea903e70ee9dc4c328e676b4906d09ad1b47836',
      },
    },
  ];

  for (const asset of assetPlan) {
    const { destination, candidates = [], download, optional, name } = asset;
    let satisfied = false;
    if (await verifyChecksum(destination, download?.sha256 ?? '')) {
      logger?.info?.(`[mediapipe] Reutilizando ${name} existente en ${destination}`) ??
        console.log(`[mediapipe] Reutilizando ${name} existente en ${destination}`);
      continue;
    }

    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        await copyFileSafe(candidate, destination, logger);
        if (await verifyChecksum(destination, download?.sha256 ?? '')) {
          satisfied = true;
          break;
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    if (satisfied) {
      continue;
    }

    if (download) {
      const succeeded = await downloadWithVerification(download.url, destination, download.sha256, logger, optional);
      if (succeeded) {
        satisfied = true;
      }
    }

    if (!satisfied && !optional) {
      logger?.warn?.(`[mediapipe] No se pudo preparar ${name}. Se intentará desde CDN en tiempo de ejecución.`) ??
        console.warn(`[mediapipe] No se pudo preparar ${name}. Se intentará desde CDN en tiempo de ejecución.`);
    }
  }
}

export async function cleanMediaPipeAssets(logger = console) {
  let entries = [];
  try {
    entries = await fs.readdir(publicModelsDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger?.info?.('[mediapipe] Carpeta de modelos ya limpia.');
      return;
    }
    throw error;
  }

  await Promise.all(
    entries.map(async (entry) => {
      if (KEEP_FILES.has(entry.name)) {
        return;
      }
      const entryPath = join(publicModelsDir, entry.name);
      if (entry.isDirectory()) {
        await fs.rm(entryPath, { recursive: true, force: true });
      } else {
        await fs.rm(entryPath, { force: true });
      }
      logger?.info?.(`[mediapipe] Eliminado ${entryPath}`) ?? console.log(`[mediapipe] Eliminado ${entryPath}`);
    })
  );
}

const invokedFromCli = Boolean(process.argv[1]) && resolve(process.argv[1]) === scriptPath;

if (invokedFromCli) {
  const wantsClean = process.argv.includes('--clean');
  const logger = console;
  (async () => {
    if (wantsClean) {
      await cleanMediaPipeAssets(logger);
    } else {
      await syncMediaPipeAssets(logger);
    }
  })().catch((error) => {
    logger.error?.('[mediapipe] Error en la sincronización de assets:', error);
    process.exitCode = 1;
  });
}
