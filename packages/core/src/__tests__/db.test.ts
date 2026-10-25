import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { nextjsGoldenCard } from '@orient/fixtures';
import {
  initDatabase,
  openDatabase,
  upsertCardRecord,
  getCardRecordByPath,
  listCardRecords,
  rebuildDatabaseCache,
  type OrientDatabase
} from '../db.js';
import type { Card } from '@orient/schema';

describe('SQLite Database Engine & Cache Self-Healing (SPRINT-3.1)', () => {
  let tempDir: string;
  let dbPath: string;
  let orientDb: OrientDatabase;

  const mockCard: Card = {
    ...nextjsGoldenCard,
    id: 'test-card-1',
    path: 'packages/core',
    level: 'folder',
    version: 1,
    state: 'Fresh'
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-db-test-'));
    dbPath = path.join(tempDir, 'orient.db');
    orientDb = openDatabase(dbPath);
    initDatabase(orientDb.raw);
  });

  afterEach(() => {
    if (orientDb && orientDb.raw.open) {
      orientDb.raw.close();
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes WAL mode, busy timeout, and all expected tables', () => {
    const pragmaMode = orientDb.raw.pragma('journal_mode', { simple: true });
    expect(pragmaMode).toBe('wal');

    const tables = orientDb.raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('cards');
    expect(tableNames).toContain('card_versions');
    expect(tableNames).toContain('files');
    expect(tableNames).toContain('change_events');
    expect(tableNames).toContain('import_edges');
  });

  it('supports full CRUD on cards with atomic version snapshots', () => {
    upsertCardRecord(orientDb, mockCard);

    const retrieved = getCardRecordByPath(orientDb, 'packages/core');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.path).toBe('packages/core');
    expect(retrieved?.state).toBe('Fresh');
    expect(retrieved?.authored.purpose).toBe(mockCard.authored.purpose);

    // Update card with version 2
    const updatedCard: Card = {
      ...mockCard,
      version: 2,
      state: 'Drifted'
    };
    upsertCardRecord(orientDb, updatedCard);

    const reRetrieved = getCardRecordByPath(orientDb, 'packages/core');
    expect(reRetrieved?.version).toBe(2);
    expect(reRetrieved?.state).toBe('Drifted');

    // Ensure version history table captured both versions
    const versions = orientDb.raw
      .prepare('SELECT version, state FROM card_versions WHERE card_path = ? ORDER BY version ASC')
      .all('packages/core') as Array<{ version: number; state: string }>;
    expect(versions).toHaveLength(2);
    expect(versions[0]?.version).toBe(1);
    expect(versions[1]?.version).toBe(2);
  });

  it('filters cards by status (state) and level', () => {
    upsertCardRecord(orientDb, mockCard);

    const fileCard: Card = {
      ...mockCard,
      id: 'test-card-2',
      path: 'packages/core/src/index.ts',
      level: 'file',
      state: 'Outdated'
    };
    upsertCardRecord(orientDb, fileCard);

    const freshCards = listCardRecords(orientDb, { state: 'Fresh' });
    expect(freshCards).toHaveLength(1);
    expect(freshCards[0]?.path).toBe('packages/core');

    const fileCards = listCardRecords(orientDb, { level: 'file' });
    expect(fileCards).toHaveLength(1);
    expect(fileCards[0]?.path).toBe('packages/core/src/index.ts');
  });

  it('self-heals and rebuilds cache transparently from durable cards on disk if DB is deleted', async () => {
    upsertCardRecord(orientDb, mockCard);

    // Create durable card json on disk in simulated .project/cards/
    const durableDir = path.join(tempDir, '.project', 'cards');
    fs.mkdirSync(durableDir, { recursive: true });
    const durableCardFile = path.join(durableDir, 'packages-core.json');
    fs.writeFileSync(durableCardFile, JSON.stringify(mockCard, null, 2), 'utf8');

    // Close and remove SQLite DB file to simulate total cache destruction / corruption
    orientDb.raw.close();
    fs.rmSync(dbPath, { force: true });
    fs.rmSync(`${dbPath}-wal`, { force: true });
    fs.rmSync(`${dbPath}-shm`, { force: true });

    // Self-healing re-open and rebuild
    const healedDb = openDatabase(dbPath);
    initDatabase(healedDb.raw);
    const rebuildResult = await rebuildDatabaseCache(healedDb, tempDir, durableDir);

    expect(rebuildResult.restoredCards).toBe(1);

    const restored = getCardRecordByPath(healedDb, 'packages/core');
    expect(restored).not.toBeNull();
    expect(restored?.path).toBe('packages/core');
    expect(restored?.authored.purpose).toBe(mockCard.authored.purpose);

    healedDb.raw.close();
  });
});
