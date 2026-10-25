import EventEmitter from 'node:events';
import { EventPayloadSchema, type EventPayload } from '@orient/schema';

export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  emitEvent(event: EventPayload): void {
    const validated = EventPayloadSchema.parse(event);
    this.emitter.emit('event', validated);
    this.emitter.emit(validated.type, validated.payload);
  }

  subscribe(listener: (event: EventPayload) => void): () => void {
    this.emitter.on('event', listener);
    return () => {
      this.emitter.off('event', listener);
    };
  }

  subscribeType<T extends EventPayload['type']>(
    type: T,
    listener: (payload: Extract<EventPayload, { type: T }>['payload']) => void
  ): () => void {
    this.emitter.on(type, listener);
    return () => {
      this.emitter.off(type, listener);
    };
  }
}
