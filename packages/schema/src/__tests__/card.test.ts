import { describe, it, expect } from 'vitest';
import {
  CardSchema,
  RoleEnum,
  CardLevelEnum,
  StalenessStateEnum,
  SourceEnum,
  AnchorSchema,
  type Card
} from '../index.js';

describe('Card & Anchor Schemas', () => {
  it('validates a complete, valid folder card', () => {
    const validCard: Card = {
      id: 'proj1:src/auth',
      level: 'folder',
      path: 'src/auth',
      version: 1,
      state: 'Fresh',
      derived: {
        fileCount: 4,
        loc: 280,
        languages: ['typescript'],
        keyFiles: [{ path: 'src/auth/jwt.ts', reason: 'Highest import centrality' }],
        dependsOn: ['src/db', 'src/config'],
        usedBy: ['src/routes/api.ts'],
        surface: {
          routes: [{ method: 'POST', path: '/api/login', handlerRef: 'src/auth/login.ts' }],
          exports: ['verifyToken', 'signToken'],
          envVars: ['JWT_SECRET'],
          tables: ['users', 'sessions'],
          ports: []
        },
        tests: {
          present: true,
          paths: ['tests/auth.test.ts'],
          command: 'vitest run tests/auth.test.ts'
        },
        health: {
          lastChanged: '2026-10-25T12:00:00Z',
          todoCount: 0,
          hasTests: true
        }
      },
      authored: {
        purpose: 'Authentication service providing JWT issuance, session validation, and password hashing.',
        role: 'services',
        why: 'Added to secure customer endpoints following OAuth2 bearer pattern.',
        oneThing: 'Always verify JWT expiration before checking database session revocation.',
        conventions: [
          'Use Argon2id for password hashing',
          'Token secrets loaded strictly from config wrapper'
        ],
        doNot: [
          'Do not store plain tokens in logs',
          'Never disable expiration in production'
        ],
        decisions: [
          {
            choice: 'Stateless JWT with revocation list',
            alternatives: ['Stateful server sessions'],
            reason: 'Horizontal scaling requirement'
          }
        ],
        representativeFile: {
          path: 'src/auth/jwt.ts',
          snippetRange: [1, 25]
        },
        contrast: 'Uses stateless JWTs instead of Redis sessions'
      },
      meta: {
        source: 'agent-reported',
        agent: {
          name: 'Claude Code',
          sessionId: 'sess_123',
          color: '#E07A5F'
        },
        confidence: 'high',
        evidence: [
          { kind: 'file', ref: 'src/auth/jwt.ts', note: 'Token creation function' },
          { kind: 'route', ref: 'POST /api/login', note: 'Login mount' }
        ],
        anchor: {
          commit: 'c0ffee1234567890abcdef1234567890abcdef12',
          tree: 'tree123',
          interface: 'iface123'
        },
        pinned: false,
        createdAt: '2026-10-25T10:00:00Z',
        updatedAt: '2026-10-25T12:00:00Z',
        origin: {
          commit: 'c0ffee1234567890abcdef1234567890abcdef12',
          promptSummary: 'Add JWT auth service'
        }
      }
    };

    const parsed = CardSchema.parse(validCard);
    expect(parsed.id).toBe('proj1:src/auth');
    expect(parsed.authored.role).toBe('services');
    expect(parsed.version).toBe(1);
  });

  it('rejects cards with an invalid role', () => {
    const invalidCard = {
      id: 'proj1:src/unknown',
      level: 'folder',
      path: 'src/unknown',
      version: 1,
      state: 'Fresh',
      derived: {
        fileCount: 1,
        loc: 10,
        languages: ['ts'],
        keyFiles: [],
        dependsOn: [],
        usedBy: [],
        surface: { routes: [], exports: [], envVars: [], tables: [], ports: [] },
        tests: { present: false, paths: [] },
        health: { lastChanged: '2026-10-25', todoCount: 0, hasTests: false }
      },
      authored: {
        purpose: 'Some purpose',
        role: 'invalid-nonexistent-role',
        why: 'Why',
        oneThing: 'One thing',
        conventions: [],
        doNot: [],
        decisions: []
      },
      meta: {
        source: 'agent-reported',
        confidence: 'high',
        evidence: [],
        anchor: { commit: 'abc' },
        pinned: false,
        createdAt: '2026-10-25',
        updatedAt: '2026-10-25'
      }
    };

    expect(() => CardSchema.parse(invalidCard)).toThrow();
  });

  it('validates an Anchor object', () => {
    const anchor = {
      commit: 'abc1234',
      blob: 'blob123',
      normalized: 'norm123',
      interface: 'iface123',
      structure: 'struct123'
    };
    const parsed = AnchorSchema.parse(anchor);
    expect(parsed.commit).toBe('abc1234');
    expect(parsed.interface).toBe('iface123');
  });

  it('exports all 23 standard roles in RoleEnum', () => {
    expect(RoleEnum.options).toHaveLength(23);
    expect(RoleEnum.options).toContain('entrypoint');
    expect(RoleEnum.options).toContain('controllers');
    expect(RoleEnum.options).toContain('repositories');
    expect(RoleEnum.options).toContain('ui-components');
  });

  it('exports all 5 staleness states', () => {
    expect(StalenessStateEnum.options).toEqual([
      'Fresh',
      'Drifted',
      'Outdated',
      'Affected',
      'Unknown'
    ]);
    expect(CardLevelEnum.options).toEqual(['repo', 'folder', 'file']);
    expect(SourceEnum.options).toEqual(['agent-reported', 'generated', 'human']);
  });
});
