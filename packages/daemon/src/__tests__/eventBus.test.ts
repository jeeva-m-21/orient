import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { EventBus } from '../eventBus.js';
import { startDaemon, type DaemonInstance } from '../lifecycle.js';
import type { EventPayload } from '@orient/schema';

describe('Realtime Event Bus & SSE Stream (SPRINT-4.3)', () => {
  let eventBus: EventBus;
  let tempConfigDir: string;
  let tempRepo: string;
  let daemon: DaemonInstance;

  beforeEach(async () => {
    eventBus = new EventBus();
    tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-bus-cfg-'));
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-bus-repo-'));

    daemon = await startDaemon({
      port: 4485,
      host: '127.0.0.1',
      configDir: tempConfigDir,
      repoRoot: tempRepo
    });
  });

  afterEach(async () => {
    if (daemon) {
      await daemon.stop();
    }
    fs.rmSync(tempConfigDir, { recursive: true, force: true });
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  describe('EventBus', () => {
    it('delivers typed events to registered subscribers', () => {
      const received: EventPayload[] = [];
      const unsubscribe = eventBus.subscribe((event) => {
        received.push(event);
      });

      const scanEvent: EventPayload = {
        type: 'scan.progress',
        payload: { phase: 'indexing', done: 50, total: 100 }
      };

      const cardEvent: EventPayload = {
        type: 'card.updated',
        payload: {
          cardId: 'card-1',
          status: 'Fresh',
          source: 'human',
          version: 2
        }
      };

      eventBus.emitEvent(scanEvent);
      eventBus.emitEvent(cardEvent);

      expect(received).toHaveLength(2);
      expect(received[0]?.type).toBe('scan.progress');
      expect(received[1]?.type).toBe('card.updated');

      unsubscribe();
      eventBus.emitEvent(scanEvent);
      expect(received).toHaveLength(2); // No new events received after unsubscribe
    });
  });

  describe('SSE Stream Endpoint (/events)', () => {
    it('streams real-time SSE events over HTTP to authenticated clients', async () => {
      // Connect to SSE stream
      const sseEvents: Array<{ event: string; data: Record<string, unknown> | string }> = [];

      const sseReq = http.request({
        hostname: '127.0.0.1',
        port: daemon.port,
        path: `/events?token=${daemon.token}`,
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Host: `127.0.0.1:${daemon.port}`
        },
        agent: false
      });

      const connectedPromise = new Promise<void>((resolve) => {
        sseReq.on('response', (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers['content-type']).toContain('text/event-stream');

          res.on('data', (chunk: Buffer) => {
            const raw = chunk.toString('utf8');
            const lines = raw.split('\n');
            let eventName = 'message';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataStr = line.slice(5).trim();
              }
            }

            if (dataStr) {
              try {
                sseEvents.push({ event: eventName, data: JSON.parse(dataStr) });
              } catch {
                sseEvents.push({ event: eventName, data: dataStr });
              }
              resolve();
            }
          });
        });
      });

      sseReq.end();
      await connectedPromise;

      // Initial connection event received
      expect(sseEvents.length).toBeGreaterThanOrEqual(1);
      expect(sseEvents[0]?.event).toBe('connected');

      // Now emit an event through the daemon's event bus
      const cardUpdatedEvent: EventPayload = {
        type: 'card.updated',
        payload: {
          cardId: 'packages/core',
          status: 'Fresh',
          source: 'agent-reported',
          version: 1
        }
      };

      const eventPromise = new Promise<void>((resolve) => {
        daemon.eventBus.subscribe((e) => {
          if (e.type === 'card.updated') {
            setTimeout(resolve, 50);
          }
        });
      });

      daemon.eventBus.emitEvent(cardUpdatedEvent);
      await eventPromise;

      const receivedCardEvent = sseEvents.find((e) => e.event === 'card.updated');
      expect(receivedCardEvent).toBeDefined();
      expect((receivedCardEvent?.data as { cardId?: string })?.cardId).toBe('packages/core');

      sseReq.destroy();
    });
  });
});
