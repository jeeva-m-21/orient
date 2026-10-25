import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { openDatabase, initDatabase, upsertCardRecord, type OrientDatabase } from '../db.js';
import { initFtsIndex, searchTask } from '../search.js';
import type { Card } from '@orient/schema';

describe('BM25 Lexical Task Search & 1-Hop Graph Retrieval (SPRINT-5.3)', () => {
  let tmpDir: string;
  let db: OrientDatabase;

  const authCard: Card = {
    id: 'card:folder:src/auth',
    level: 'folder',
    path: 'src/auth',
    version: 1,
    state: 'Fresh',
    derived: {
      fileCount: 3,
      loc: 180,
      languages: ['typescript'],
      keyFiles: [
        { path: 'src/auth/routes.ts', reason: 'Login and session route declarations' },
        { path: 'src/auth/jwt.ts', reason: 'JWT session tokens' }
      ],
      dependsOn: ['src/db'],
      usedBy: ['src/controllers'],
      surface: {
        routes: [
          { method: 'POST', path: '/auth/login', handlerRef: 'src/auth/routes.ts' },
          { method: 'POST', path: '/auth/logout', handlerRef: 'src/auth/routes.ts' }
        ],
        exports: ['authRoutes', 'verifySession'],
        envVars: ['JWT_SECRET', 'SESSION_EXPIRY'],
        tables: ['users', 'sessions'],
        ports: [4477]
      },
      tests: {
        present: true,
        paths: ['src/auth/__tests__/auth.test.ts']
      },
      health: {
        lastChanged: '2026-10-25T12:00:00Z',
        todoCount: 0,
        hasTests: true
      }
    },
    authored: {
      purpose: 'Authentication subsystem managing user login, passwords, and sessions.',
      role: 'routes',
      why: 'Enforces identity verification and session rotation across all API endpoints.',
      oneThing: 'Never store sensitive tokens in unencrypted client storage.',
      conventions: [
        'Enforce rate limiting on login attempts to thwart brute-force attacks',
        'Export route handlers as async functions'
      ],
      doNot: ['Never commit hardcoded secrets or JWT secrets'],
      decisions: []
    },
    meta: {
      source: 'human',
      confidence: 'high',
      evidence: [],
      anchor: { commit: 'commit_hash_1' },
      pinned: true,
      createdAt: '2026-10-25T12:00:00Z',
      updatedAt: '2026-10-25T12:00:00Z'
    }
  };

  const controllerCard: Card = {
    id: 'card:folder:src/controllers',
    level: 'folder',
    path: 'src/controllers',
    version: 1,
    state: 'Fresh',
    derived: {
      fileCount: 4,
      loc: 300,
      languages: ['typescript'],
      keyFiles: [{ path: 'src/controllers/authController.ts', reason: 'Handles HTTP requests' }],
      dependsOn: ['src/auth', 'src/db'],
      usedBy: [],
      surface: {
        routes: [],
        exports: ['handleLoginRequest'],
        envVars: [],
        tables: [],
        ports: []
      },
      tests: {
        present: true,
        paths: []
      },
      health: {
        lastChanged: '2026-10-25T12:00:00Z',
        todoCount: 0,
        hasTests: true
      }
    },
    authored: {
      purpose: 'HTTP request controllers coordinating input validation and business logic.',
      role: 'controllers',
      why: 'Keeps HTTP framing decoupled from database storage.',
      oneThing: 'Controllers must validate external inputs before calling services.',
      conventions: ['Return standardized JSON response envelopes'],
      doNot: [],
      decisions: []
    },
    meta: {
      source: 'generated',
      confidence: 'medium',
      evidence: [],
      anchor: { commit: 'commit_hash_1' },
      pinned: false,
      createdAt: '2026-10-25T12:00:00Z',
      updatedAt: '2026-10-25T12:00:00Z'
    }
  };

  const billingCard: Card = {
    id: 'card:folder:src/billing',
    level: 'folder',
    path: 'src/billing',
    version: 1,
    state: 'Fresh',
    derived: {
      fileCount: 2,
      loc: 150,
      languages: ['typescript'],
      keyFiles: [{ path: 'src/billing/stripe.ts', reason: 'Stripe webhook receiver' }],
      dependsOn: ['src/db'],
      usedBy: [],
      surface: {
        routes: [{ method: 'POST', path: '/billing/webhook', handlerRef: 'src/billing/stripe.ts' }],
        exports: ['handleStripeWebhook'],
        envVars: ['STRIPE_SECRET'],
        tables: ['subscriptions'],
        ports: []
      },
      tests: { present: false, paths: [] },
      health: { lastChanged: '2026-10-25T12:00:00Z', todoCount: 0, hasTests: false }
    },
    authored: {
      purpose: 'Payment processing and Stripe webhook synchronization.',
      role: 'services',
      why: 'Manages customer subscriptions and invoice generation.',
      oneThing: 'Always verify Stripe signature headers.',
      conventions: ['Keep payment logic isolated from user profile data'],
      doNot: [],
      decisions: []
    },
    meta: {
      source: 'generated',
      confidence: 'medium',
      evidence: [],
      anchor: { commit: 'commit_hash_1' },
      pinned: false,
      createdAt: '2026-10-25T12:00:00Z',
      updatedAt: '2026-10-25T12:00:00Z'
    }
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-search-'));
    const dbPath = path.join(tmpDir, 'orient.db');
    db = openDatabase(dbPath);
    initDatabase(db.raw);
    initFtsIndex(db.raw);

    // Upsert cards into SQLite
    upsertCardRecord(db, authCard);
    upsertCardRecord(db, controllerCard);
    upsertCardRecord(db, billingCard);

    // Insert 1-hop import edge: src/controllers -> src/auth
    db.raw.prepare(`
      INSERT INTO import_edges (from_path, to_path, import_type, created_at)
      VALUES (?, ?, ?, ?)
    `).run('src/controllers/authController.ts', 'src/auth/routes.ts', 'esm', new Date().toISOString());
  });

  afterEach(() => {
    db.raw.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ranks relevant cards by BM25 match and returns conventions in under 100ms', () => {
    const result = searchTask(db.raw, 'add rate limit to login');

    expect(result.elapsedMs).toBeLessThan(100);
    expect(result.matches.length).toBeGreaterThan(0);

    // Auth card should rank #1 because it matches login, rate limit, auth
    const topMatch = result.matches[0];
    expect(topMatch!.card.path).toBe('src/auth');
    expect(topMatch!.card.authored.role).toBe('routes');

    // Should return conventions matching top folders
    expect(result.conventions).toContain('Enforce rate limiting on login attempts to thwart brute-force attacks');
  });

  it('expands retrieval along 1-hop import edges to include connected touchpoints', () => {
    const result = searchTask(db.raw, 'rate limit login');

    // 1-hop expansion should discover connected controllers
    expect(result.affectedTouchpoints).toEqual(
      expect.arrayContaining(['src/controllers/authController.ts'])
    );
  });

  it('handles empty or special character queries safely without throwing syntax errors', () => {
    expect(() => searchTask(db.raw, '')).not.toThrow();
    expect(() => searchTask(db.raw, '*** &&& ||| "login"')).not.toThrow();
    expect(() => searchTask(db.raw, 'nonexistent_symbol_xyz123')).not.toThrow();
  });
});
