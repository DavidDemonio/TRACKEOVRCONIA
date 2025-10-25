import dgram from 'dgram';
import { BodyFrame, jointNames, SlimeVrSink } from '@trackeovrconia/proto';
import pino from 'pino';

const logger = pino({ name: 'slimevr-adapter' });

type TrackerPacket = {
  trackerId: string;
  joint: string;
  position?: number[];
  rotation?: number[];
  confidence?: number;
};

export class SlimeVrAdapter {
  private socket = dgram.createSocket('udp4');

  constructor(private readonly sink: SlimeVrSink) {}

  publish(frame: BodyFrame): void {
    const packets: TrackerPacket[] = [];
    jointNames.forEach((joint) => {
      const data = frame.joints[joint];
      if (!data) return;
      packets.push({
        trackerId: `${this.sink.profileId}:${joint}`,
        joint,
        position: data.pos,
        rotation: data.rotQuat,
        confidence: data.conf,
      });
    });

    if (!packets.length) return;
    const payload = Buffer.from(JSON.stringify({ type: 'trackers', trackers: packets }));
    this.socket.send(payload, this.sink.port, this.sink.host, (error) => {
      if (error) {
        logger.error({ error }, 'Failed to send slimevr packet');
      }
    });
  }
}
