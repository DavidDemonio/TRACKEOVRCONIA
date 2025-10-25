import { promises as fs } from 'fs';
import path from 'path';
import { defaultConfig, configFileSchema, ConfigFile, ServerConfig, sinkSchema, Sink } from '@trackeovrconia/proto';
import pino from 'pino';

const CONFIG_PATH = path.resolve(process.cwd(), 'config/config.json');

const logger = pino({ name: 'config-store' });

export class ConfigStore {
  private data: ConfigFile = { server: defaultConfig, slimevr: { trackers: {} } };

  constructor(private readonly filePath = CONFIG_PATH) {}

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.data = configFileSchema.parse(JSON.parse(raw));
      logger.info({ path: this.filePath }, 'Loaded configuration file');
    } catch (error) {
      logger.warn({ error }, 'Using default configuration');
      await this.persist();
    }
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
  }

  private async persist(): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
  }

  getServerConfig(): ServerConfig {
    return this.data.server;
  }

  async updateServerConfig(update: Partial<ServerConfig>): Promise<ServerConfig> {
    const merged = { ...this.data.server, ...update, video: { ...this.data.server.video, ...update.video } };
    this.data.server = configFileSchema.shape.server.parse(merged);
    await this.persist();
    return this.data.server;
  }

  listSinks(): Sink[] {
    return this.data.server.sinks;
  }

  async setSinks(sinks: Sink[]): Promise<Sink[]> {
    this.data.server.sinks = sinks.map((sink) => sinkSchema.parse(sink));
    await this.persist();
    return this.listSinks();
  }

  async saveSlimeVrProfile(profileId: string, data: ConfigFile['slimevr']['trackers'][string]): Promise<void> {
    this.data.slimevr.trackers[profileId] = data;
    await this.persist();
  }
}

export const configStore = new ConfigStore();
