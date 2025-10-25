import dgram from 'dgram';
import osc from 'osc-min';
import { BodyFrame, JointName, OscSink } from '@trackeovrconia/proto';
import pino from 'pino';

const logger = pino({ name: 'osc-sink' });

export class OscPublisher {
  private socket = dgram.createSocket('udp4');

  constructor(private readonly sink: OscSink) {}

  publish(frame: BodyFrame): void {
    const jointEntries = Object.entries(frame.joints) as [JointName, BodyFrame['joints'][JointName]][];
    jointEntries.forEach(([joint, data]) => {
      if (!data) return;
      const namespace = `${this.sink.namespace}/${joint}`;
      if (data.pos) {
        this.send(`${namespace}/pos`, data.pos);
      }
      if (data.rotQuat) {
        this.send(`${namespace}/rotQuat`, data.rotQuat);
      }
      if (data.conf !== undefined) {
        this.send(`${namespace}/conf`, [data.conf]);
      }
    });
  }

  private send(address: string, args: unknown[]): void {
    try {
      const buf = osc.toBuffer({ address, args });
      this.socket.send(buf, this.sink.port, this.sink.host);
    } catch (error) {
      logger.error({ error }, 'Failed to send OSC packet');
    }
  }
}
