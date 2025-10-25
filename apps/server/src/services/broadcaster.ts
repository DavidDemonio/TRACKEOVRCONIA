import { BodyFrame, Sink } from '@trackeovrconia/proto';
import { OscPublisher } from '../sinks/osc.js';
import { SlimeVrAdapter } from '../slimevr/adapter.js';

export class SinkBroadcaster {
  private oscillators = new Map<string, OscPublisher>();
  private slimeAdapters = new Map<string, SlimeVrAdapter>();

  updateSinks(sinks: Sink[]): void {
    const osc = sinks.filter((sink) => sink.type === 'osc');
    const slime = sinks.filter((sink) => sink.type === 'slimevr');
    this.oscillators.clear();
    this.slimeAdapters.clear();
    osc.forEach((sink) => this.oscillators.set(sink.id, new OscPublisher(sink)));
    slime.forEach((sink) => this.slimeAdapters.set(sink.id, new SlimeVrAdapter(sink)));
  }

  publish(frame: BodyFrame): void {
    this.oscillators.forEach((publisher) => publisher.publish(frame));
    this.slimeAdapters.forEach((adapter) => adapter.publish(frame));
  }
}

export const sinkBroadcaster = new SinkBroadcaster();
