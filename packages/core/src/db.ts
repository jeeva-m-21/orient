import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { CardSchema, type Card } from '@orient/schema';

export interface OrientDatabase {
  raw: Database.Database;
  path: string;
}

export function openDatabase(dbPath: string): OrientDatabase {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const raw = new Database(dbPath);

  // WAL mode and performance pragmas
  raw.pragma('journal_mode = WAL');
  raw.pragma('busy_timeout = 5000');
  raw.pragma('synchronous = NORMAL');
  raw.pragma('foreign_keys = ON');
  raw.pragma('mmap_size = 268435456');

  return { raw, path: dbPath };
}

export function initDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      level TEXT NOT NULL,
      version INTEGER NOT NULL,
      state TEXT NOT NULL,
      derived_json TEXT NOT NULL,
      authored_json TEXT NOT NULL,
      meta_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cards_path ON cards(path);
    CREATE INDEX IF NOT EXISTS idx_cards_state ON cards(state);
    CREATE INDEX IF NOT EXISTS idx_cards_level ON cards(level);

    CREATE TABLE IF NOT EXISTS card_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id TEXT NOT NULL,
      card_path TEXT NOT NULL,
      version INTEGER NOT NULL,
      state TEXT NOT NULL,
      derived_json TEXT NOT NULL,
      authored_json TEXT NOT NULL,
      meta_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_card_versions_card_id ON card_versions(card_id);
    CREATE INDEX IF NOT EXISTS idx_card_versions_path ON card_versions(card_path);

    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      blob_hash TEXT NOT NULL,
      normalized_hash TEXT,
      interface_hash TEXT,
      language TEXT,
      loc INTEGER DEFAULT 0,
      todo_count INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS change_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_path TEXT NOT NULL,
      to_path TEXT NOT NULL,
      import_type TEXT DEFAULT 'esm',
      created_at TEXT NOT NULL,
      UNIQUE(from_path, to_path)
    );

    CREATE INDEX IF NOT EXISTS idx_import_edges_to ON import_edges(to_path);
  `);
}

interface RawCardRow {
  id: string;
  path: string;
  level: string;
  version: number;
  state: string;
  derived_json: string;
  authored_json: string;
  meta_json: string;
  updated_at: string;
}

function parseCardRow(row: RawCardRow): Card {
  const cardData = {
    id: row.id,
    path: row.path,
    level: row.level,
    version: row.version,
    state: row.state,
    derived: JSON.parse(row.derived_json),
    authored: JSON.parse(row.authored_json),
    meta: JSON.parse(row.meta_json)
  };

  return CardSchema.parse(cardData);
}

export function upsertCardRecord(orientDb: OrientDatabase, card: Card): void {
  const validated = CardSchema.parse(card);

  const upsertStmt = orientDb.raw.prepare(`
    INSERT INTO cards (id, path, level, version, state, derived_json, authored_json, meta_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      id = excluded.id,
      level = excluded.level,
      version = excluded.version,
      state = excluded.state,
      derived_json = excluded.derived_json,
      authored_json = excluded.authored_json,
      meta_json = excluded.meta_json,
      updated_at = excluded.updated_at
  `);

  const versionStmt = orientDb.raw.prepare(`
    INSERT INTO card_versions (card_id, card_path, version, state, derived_json, authored_json, meta_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const derivedJson = JSON.stringify(validated.derived);
  const authoredJson = JSON.stringify(validated.authored);
  const metaJson = JSON.stringify(validated.meta);
  const updatedAt = validated.meta.updatedAt || new Date().toISOString();

  const transaction = orientDb.raw.transaction(() => {
    upsertStmt.run(
      validated.id,
      validated.path,
      validated.level,
      validated.version,
      validated.state,
      derivedJson,
      authoredJson,
      metaJson,
      updatedAt
    );

    versionStmt.run(
      validated.id,
      validated.path,
      validated.version,
      validated.state,
      derivedJson,
      authoredJson,
      metaJson,
      updatedAt
    );
  });

  transaction();
}

export function getCardRecordByPath(orientDb: OrientDatabase, cardPath: string): Card | null {
  const stmt = orientDb.raw.prepare(`
    SELECT id, path, level, version, state, derived_json, authored_json, meta_json, updated_at
    FROM cards WHERE path = ?
  `);

  const row = stmt.get(cardPath) as RawCardRow | undefined;
  if (!row) return null;

  return parseCardRow(row);
}

export function listCardRecords(
  orientDb: OrientDatabase,
  filter?: { state?: string; level?: string }
): Card[] {
  let query = `
    SELECT id, path, level, version, state, derived_json, authored_json, meta_json, updated_at
    FROM cards
  `;
  const params: string[] = [];
  const conditions: string[] = [];

  if (filter?.state) {
    conditions.push('state = ?');
    params.push(filter.state);
  }

  if (filter?.level) {
    conditions.push('level = ?');
    params.push(filter.level);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY path ASC';

  const stmt = orientDb.raw.prepare(query);
  const rows = stmt.all(...params) as RawCardRow[];

  return rows.map(parseCardRow);
}

export async function rebuildDatabaseCache(
  orientDb: OrientDatabase,
  projectPath: string,
  durableCardsDir?: string
): Promise<{ restoredCards: number; indexedFiles: number }> {
  initDatabase(orientDb.raw);

  const cardsDir = durableCardsDir || path.join(projectPath, '.project', 'cards');
  let restoredCards = 0;

  if (fs.existsSync(cardsDir)) {
    const files = fs.readdirSync(cardsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(cardsDir, file);
          const raw = fs.readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(raw);
          const card = CardSchema.parse(parsed);
          upsertCardRecord(orientDb, card);
          restoredCards++;
        } catch {
          // Skip corrupt or unparseable files during self-healing
        }
      }
    }
  }

  return { restoredCards, indexedFiles: 0 };
}
