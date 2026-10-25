import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  PathMutex,
  mergeCardSlots,
  applyCardUpdate
} from '../concurrency.js';
import { openDatabase, initDatabase, upsertCardRecord, type OrientDatabase } from '../db.js';
import type { Card } from '@orient/schema';
import { nextjsGoldenCard } from '@orient/fixtures';

describe('Optimistic Concurrency Control & Per-Path Mutex (SPRINT-3.4)', () => {
  let tempDir: string;
  let dbPath: string;
  let orientDb: OrientDatabase;

  const baseCard: Card = {
    ...nextjsGoldenCard,
    id: 'card:packages/core',
    path: 'packages/core',
    version: 1,
    authored: {
      ...nextjsGoldenCard.authored,
      purpose: 'Initial purpose',
      conventions: ['Strict typing'],
      doNot: ['Never swallow errors'],
      decisions: [{ choice: 'SQLite', reason: 'Local first' }]
    }
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-concurrency-test-'));
    dbPath = path.join(tempDir, 'orient.db');
    orientDb = openDatabase(dbPath);
    initDatabase(orientDb.raw);
    upsertCardRecord(orientDb, baseCard);
  });

  afterEach(() => {
    if (orientDb && orientDb.raw.open) {
      orientDb.raw.close();
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('PathMutex', () => {
    it('serializes operations on the same path while allowing parallel execution on different paths', async () => {
      const mutex = new PathMutex();
      const executionLog: string[] = [];

      const taskA1 = async () => {
        const release = await mutex.acquire('path/foo');
        executionLog.push('A1:start');
        await new Promise((r) => setTimeout(r, 20));
        executionLog.push('A1:end');
        release();
      };

      const taskA2 = async () => {
        const release = await mutex.acquire('path/foo');
        executionLog.push('A2:start');
        await new Promise((r) => setTimeout(r, 10));
        executionLog.push('A2:end');
        release();
      };

      const taskB = async () => {
        const release = await mutex.acquire('path/bar');
        executionLog.push('B:start');
        await new Promise((r) => setTimeout(r, 10));
        executionLog.push('B:end');
        release();
      };

      // Run all tasks concurrently
      await Promise.all([taskA1(), taskA2(), taskB()]);

      // taskA1 and taskA2 on 'path/foo' must be strictly serialized: A1 finishes before A2 starts
      const a1EndIdx = executionLog.indexOf('A1:end');
      const a2StartIdx = executionLog.indexOf('A2:start');
      expect(a1EndIdx).toBeLessThan(a2StartIdx);

      // taskB on 'path/bar' started immediately without waiting for taskA1 to finish
      const bStartIdx = executionLog.indexOf('B:start');
      expect(bStartIdx).toBeLessThan(a2StartIdx);
    });
  });

  describe('mergeCardSlots', () => {
    it('merges non-overlapping disjoint updates from two concurrent agents', () => {
      // Base: version 1
      const base = baseCard.authored;

      // Current in DB (modified by Agent A: added a convention):
      const current = {
        ...base,
        conventions: ['Strict typing', 'Always use Zod validation']
      };

      // Incoming update from Agent B (who branched from Base v1 and added a decision):
      const incoming = {
        ...base,
        decisions: [
          { choice: 'SQLite', reason: 'Local first' },
          { choice: 'Chokidar', reason: 'Cross-platform watcher' }
        ]
      };

      const mergeResult = mergeCardSlots(base, current, incoming);

      expect(mergeResult.status).toBe('merged');
      if (mergeResult.status === 'merged') {
        expect(mergeResult.mergedSlots).toContain('decisions');
        expect(mergeResult.mergedAuthored.conventions).toContain('Always use Zod validation');
        expect(mergeResult.mergedAuthored.decisions).toHaveLength(2);
      }
    });

    it('rejects conflicting overlapping updates to the same slot', () => {
      const base = baseCard.authored;

      // Current in DB: Agent A changed purpose
      const current = {
        ...base,
        purpose: 'Purpose changed by Agent A'
      };

      // Incoming: Agent B also changed purpose to something else
      const incoming = {
        ...base,
        purpose: 'Purpose changed by Agent B'
      };

      const mergeResult = mergeCardSlots(base, current, incoming);

      expect(mergeResult.status).toBe('conflict');
      if (mergeResult.status === 'conflict') {
        expect(mergeResult.conflictSlots).toContain('purpose');
      }
    });
  });

  describe('applyCardUpdate (OCC pipeline)', () => {
    it('applies clean update when expectedVersion matches current card version', async () => {
      const mutex = new PathMutex();
      const updateResult = await applyCardUpdate({
        orientDb,
        repoRoot: tempDir,
        mutex,
        path: 'packages/core',
        expectedVersion: 1,
        authoredUpdates: {
          why: 'Updated rationale'
        }
      });

      expect(updateResult.status).toBe('updated');
      if (updateResult.status === 'updated') {
        expect(updateResult.card.version).toBe(2);
        expect(updateResult.card.authored.why).toBe('Updated rationale');
      }
    });

    it('auto-merges disjoint concurrent edits and increments card version', async () => {
      const mutex = new PathMutex();

      // Agent A updates conventions (version becomes 2)
      await applyCardUpdate({
        orientDb,
        repoRoot: tempDir,
        mutex,
        path: 'packages/core',
        expectedVersion: 1,
        authoredUpdates: {
          conventions: ['Strict typing', 'Always use Zod validation']
        }
      });

      // Agent B was operating on expectedVersion: 1 and updates decisions
      const agentBResult = await applyCardUpdate({
        orientDb,
        repoRoot: tempDir,
        mutex,
        path: 'packages/core',
        expectedVersion: 1, // Stale version!
        authoredUpdates: {
          decisions: [{ choice: 'SQLite WAL mode', reason: 'High concurrency' }]
        }
      });

      expect(agentBResult.status).toBe('merged');
      if (agentBResult.status === 'merged') {
        expect(agentBResult.card.version).toBe(3);
        // Retained Agent A's conventions
        expect(agentBResult.card.authored.conventions).toContain('Always use Zod validation');
        // Applied Agent B's decisions
        expect(agentBResult.card.authored.decisions[0]?.choice).toBe('SQLite WAL mode');
      }
    });

    it('rejects conflicting concurrent edits with descriptive conflict error', async () => {
      const mutex = new PathMutex();

      // Agent A updates why field (version becomes 2)
      await applyCardUpdate({
        orientDb,
        repoRoot: tempDir,
        mutex,
        path: 'packages/core',
        expectedVersion: 1,
        authoredUpdates: {
          why: 'Why reason from Agent A'
        }
      });

      // Agent B also tries to update why field based on stale expectedVersion: 1
      const conflictResult = await applyCardUpdate({
        orientDb,
        repoRoot: tempDir,
        mutex,
        path: 'packages/core',
        expectedVersion: 1,
        authoredUpdates: {
          why: 'Why reason from Agent B'
        }
      });

      expect(conflictResult.status).toBe('conflict');
      if (conflictResult.status === 'conflict') {
        expect(conflictResult.currentVersion).toBe(2);
        expect(conflictResult.conflictSlots).toContain('why');
      }
    });
  });
});
