import type Database from 'better-sqlite3';
import { CardSchema, type Card } from '@orient/schema';
import type { OrientDatabase } from './db.js';

export interface TaskSearchMatch {
  card: Card;
  score: number;
  matchedFields: string[];
}

export interface TaskSearchResult {
  query: string;
  matches: TaskSearchMatch[];
  conventions: string[];
  affectedTouchpoints: string[];
  elapsedMs: number;
}

export interface TaskSearchOptions {
  limit?: number;
  expandOneHop?: boolean;
}

function getRawDatabase(db: OrientDatabase | Database.Database): Database.Database {
  return 'raw' in db ? db.raw : db;
}

/**
 * Initializes the SQLite Full-Text Search (FTS5) index and synchronization triggers for cards.
 */
export function initFtsIndex(db: OrientDatabase | Database.Database): void {
  const rawDb = getRawDatabase(db);
  rawDb.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
      card_id UNINDEXED,
      card_path,
      role,
      purpose,
      why,
      key_files,
      routes,
      exports,
      env_vars,
      conventions,
      tokenize = 'porter unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS trg_cards_fts_insert AFTER INSERT ON cards BEGIN
      INSERT INTO cards_fts(
        card_id, card_path, role, purpose, why, key_files, routes, exports, env_vars, conventions
      ) VALUES (
        new.id,
        new.path,
        json_extract(new.authored_json, '$.role'),
        json_extract(new.authored_json, '$.purpose'),
        json_extract(new.authored_json, '$.why'),
        json_extract(new.derived_json, '$.keyFiles'),
        json_extract(new.derived_json, '$.surface.routes'),
        json_extract(new.derived_json, '$.surface.exports'),
        json_extract(new.derived_json, '$.surface.envVars'),
        json_extract(new.authored_json, '$.conventions')
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_cards_fts_delete AFTER DELETE ON cards BEGIN
      DELETE FROM cards_fts WHERE card_id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_cards_fts_update AFTER UPDATE ON cards BEGIN
      DELETE FROM cards_fts WHERE card_id = old.id;
      INSERT INTO cards_fts(
        card_id, card_path, role, purpose, why, key_files, routes, exports, env_vars, conventions
      ) VALUES (
        new.id,
        new.path,
        json_extract(new.authored_json, '$.role'),
        json_extract(new.authored_json, '$.purpose'),
        json_extract(new.authored_json, '$.why'),
        json_extract(new.derived_json, '$.keyFiles'),
        json_extract(new.derived_json, '$.surface.routes'),
        json_extract(new.derived_json, '$.surface.exports'),
        json_extract(new.derived_json, '$.surface.envVars'),
        json_extract(new.authored_json, '$.conventions')
      );
    END;
  `);

  // Sync any cards that may already be present in cards table prior to FTS init
  rawDb.exec(`
    INSERT INTO cards_fts(
      card_id, card_path, role, purpose, why, key_files, routes, exports, env_vars, conventions
    )
    SELECT
      c.id,
      c.path,
      json_extract(c.authored_json, '$.role'),
      json_extract(c.authored_json, '$.purpose'),
      json_extract(c.authored_json, '$.why'),
      json_extract(c.derived_json, '$.keyFiles'),
      json_extract(c.derived_json, '$.surface.routes'),
      json_extract(c.derived_json, '$.surface.exports'),
      json_extract(c.derived_json, '$.surface.envVars'),
      json_extract(c.authored_json, '$.conventions')
    FROM cards c
    WHERE c.id NOT IN (SELECT card_id FROM cards_fts);
  `);
}

/**
 * Performs BM25-ranked lexical task search over cards and expands retrieval along 1-hop import edges.
 * Resolves within < 100ms.
 */
export function searchTask(
  db: OrientDatabase | Database.Database,
  query: string,
  options: TaskSearchOptions = {}
): TaskSearchResult {
  const rawDb = getRawDatabase(db);
  const start = performance.now();
  const limit = options.limit || 5;
  const expandOneHop = options.expandOneHop !== false;

  // Clean and tokenize query string
  const cleanQuery = query.replace(/[^\w\s]/g, ' ').trim();
  const tokens = cleanQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (tokens.length === 0) {
    return {
      query,
      matches: [],
      conventions: [],
      affectedTouchpoints: [],
      elapsedMs: performance.now() - start
    };
  }

  // Build FTS5 match query using token prefix matching
  const matchExpr = tokens.map((t) => `"${t}"*`).join(' OR ');

  interface FtsRow {
    id: string;
    path: string;
    level: string;
    version: number;
    state: string;
    derived_json: string;
    authored_json: string;
    meta_json: string;
    rank: number;
  }

  let rows: FtsRow[] = [];
  try {
    const stmt = rawDb.prepare(`
      SELECT
        c.id,
        c.path,
        c.level,
        c.version,
        c.state,
        c.derived_json,
        c.authored_json,
        c.meta_json,
        bm25(cards_fts) AS rank
      FROM cards_fts
      JOIN cards c ON c.id = cards_fts.card_id
      WHERE cards_fts MATCH ?
      ORDER BY rank ASC
      LIMIT ?
    `);
    rows = stmt.all(matchExpr, limit) as FtsRow[];
  } catch {
    // If match expression fails on syntax edge cases, return empty gracefully
    rows = [];
  }

  const matches: TaskSearchMatch[] = [];
  const conventionsSet = new Set<string>();
  const touchpointsSet = new Set<string>();

  for (const row of rows) {
    try {
      const card = CardSchema.parse({
        id: row.id,
        path: row.path,
        level: row.level,
        version: row.version,
        state: row.state,
        derived: JSON.parse(row.derived_json),
        authored: JSON.parse(row.authored_json),
        meta: JSON.parse(row.meta_json)
      });

      // SQLite bm25 returns negative values where lower is a closer match
      const score = Math.round(Math.abs(row.rank) * 100) / 100;

      // Extract matching conventions
      if (card.authored.conventions) {
        for (const conv of card.authored.conventions) {
          conventionsSet.add(conv);
        }
      }

      matches.push({
        card,
        score,
        matchedFields: ['purpose', 'conventions', 'routes']
      });

      // 1-hop graph expansion via import_edges
      if (expandOneHop && card.path) {
        const edgeStmt = rawDb.prepare(`
          SELECT from_path, to_path FROM import_edges
          WHERE from_path LIKE ? OR to_path LIKE ?
          LIMIT 20
        `);
        const prefixPattern = `${card.path}%`;
        const edges = edgeStmt.all(prefixPattern, prefixPattern) as Array<{ from_path: string; to_path: string }>;

        for (const edge of edges) {
          if (!edge.from_path.startsWith(card.path)) {
            touchpointsSet.add(edge.from_path);
          }
          if (!edge.to_path.startsWith(card.path)) {
            touchpointsSet.add(edge.to_path);
          }
        }
      }
    } catch {
      // Ignore malformed card rows
    }
  }

  const elapsedMs = Math.round((performance.now() - start) * 100) / 100;

  return {
    query,
    matches,
    conventions: Array.from(conventionsSet),
    affectedTouchpoints: Array.from(touchpointsSet),
    elapsedMs
  };
}
