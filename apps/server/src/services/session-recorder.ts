import fs, { createWriteStream, WriteStream } from 'fs';
import path from 'path';
import { BodyFrame } from '@trackeovrconia/proto';
import { randomUUID } from 'crypto';

export class SessionRecorder {
  private stream?: WriteStream;
  private startedAt?: number;
  private sessionId?: string;

  async start(): Promise<string> {
    if (this.stream) {
      throw new Error('A session is already active');
    }
    this.sessionId = randomUUID();
    const dir = path.resolve(process.cwd(), 'sessions');
    await fs.promises.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${this.sessionId}.ndjson`);
    this.stream = createWriteStream(file, { flags: 'a' });
    this.startedAt = Date.now();
    return this.sessionId;
  }

  stop(): void {
    this.stream?.end();
    this.stream = undefined;
    this.startedAt = undefined;
    this.sessionId = undefined;
  }

  record(frame: BodyFrame): void {
    if (!this.stream) return;
    const payload = JSON.stringify({ ...frame, relative: this.startedAt ? frame.timestamp - this.startedAt : 0 });
    this.stream.write(`${payload}\n`);
  }
}

export const sessionRecorder = new SessionRecorder();
