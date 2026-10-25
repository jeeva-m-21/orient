import { describe, it, expect } from 'vitest';
import {
  resolveImportPath,
  buildDependencyGraph,
  rankKeyFilesForFolder
} from '../graph.js';

describe('Dependency Graph Resolution & Centrality Ranker (SPRINT-2.4)', () => {
  const knownFiles = [
    'src/index.ts',
    'src/server.ts',
    'src/auth/jwt.ts',
    'src/auth/service.ts',
    'src/db/client.ts',
    'src/db/index.ts',
    'app/main.py',
    'app/routers/items.py',
    'app/models.py'
  ];

  describe('resolveImportPath', () => {
    it('resolves relative TypeScript imports with .js extension mapping to .ts', () => {
      const resolved = resolveImportPath('src/server.ts', './auth/jwt.js', knownFiles);
      expect(resolved).toBe('src/auth/jwt.ts');
    });

    it('resolves extensionless relative imports and folder index imports', () => {
      const resolvedFile = resolveImportPath('src/server.ts', './auth/jwt', knownFiles);
      expect(resolvedFile).toBe('src/auth/jwt.ts');

      const resolvedDir = resolveImportPath('src/server.ts', './db', knownFiles);
      expect(resolvedDir).toBe('src/db/index.ts');
    });

    it('resolves Python relative imports with single and double leading dots', () => {
      const resolvedRouter = resolveImportPath('app/main.py', '.routers.items', knownFiles);
      expect(resolvedRouter).toBe('app/routers/items.py');

      const resolvedModel = resolveImportPath('app/routers/items.py', '..models', knownFiles);
      expect(resolvedModel).toBe('app/models.py');
    });

    it('resolves Next.js and workspace path aliases with @/ prefix', () => {
      const resolvedAuth = resolveImportPath('app/api/auth/route.ts', '@/auth/jwt', knownFiles);
      expect(resolvedAuth).toBe('src/auth/jwt.ts');
    });

    it('returns null for external third-party package dependencies', () => {
      expect(resolveImportPath('src/server.ts', 'express', knownFiles)).toBeNull();
      expect(resolveImportPath('src/server.ts', 'vitest', knownFiles)).toBeNull();
      expect(resolveImportPath('app/main.py', 'fastapi', knownFiles)).toBeNull();
    });
  });

  describe('buildDependencyGraph', () => {
    it('constructs directed graph and computes accurate in-degree and out-degree metrics', () => {
      const fileData = [
        {
          path: 'src/server.ts',
          imports: [{ source: './auth/jwt.js' }, { source: './db/index.js' }]
        },
        {
          path: 'src/auth/service.ts',
          imports: [{ source: './jwt.js' }]
        },
        {
          path: 'src/auth/jwt.ts',
          imports: []
        },
        {
          path: 'src/db/index.ts',
          imports: [{ source: './client.js' }]
        },
        {
          path: 'src/db/client.ts',
          imports: []
        }
      ];

      const graph = buildDependencyGraph(fileData, knownFiles);

      // 'src/auth/jwt.ts' is imported by server.ts and service.ts -> in-degree 2
      expect(graph.inDegree.get('src/auth/jwt.ts')).toBe(2);
      expect(graph.outDegree.get('src/auth/jwt.ts')).toBe(0);

      // 'src/server.ts' imports 2 files -> out-degree 2, in-degree 0
      expect(graph.outDegree.get('src/server.ts')).toBe(2);
      expect(graph.inDegree.get('src/server.ts')).toBe(0);

      // Dependents of jwt.ts
      const jwtDependents = graph.dependentsOf.get('src/auth/jwt.ts');
      expect(jwtDependents?.has('src/server.ts')).toBe(true);
      expect(jwtDependents?.has('src/auth/service.ts')).toBe(true);
    });
  });

  describe('rankKeyFilesForFolder', () => {
    it('ranks top 3 key files with human-readable rationale based on centrality and surface', () => {
      const fileData = [
        {
          path: 'src/index.ts',
          imports: [{ source: './server.js' }]
        },
        {
          path: 'src/server.ts',
          imports: [{ source: './auth/jwt.js' }, { source: './db/index.js' }]
        },
        {
          path: 'src/auth/jwt.ts',
          imports: []
        },
        {
          path: 'src/auth/service.ts',
          imports: [{ source: './jwt.js' }]
        },
        {
          path: 'src/db/index.ts',
          imports: [{ source: './client.js' }]
        },
        {
          path: 'src/db/client.ts',
          imports: []
        }
      ];

      const graph = buildDependencyGraph(fileData, knownFiles);

      const factsMap = new Map([
        [
          'src/server.ts',
          {
            routes: [{ method: 'GET', path: '/health' }, { method: 'POST', path: '/login' }],
            exports: ['server', 'start']
          }
        ],
        [
          'src/auth/jwt.ts',
          {
            routes: [],
            exports: ['verifyToken', 'signToken', 'decodeToken']
          }
        ]
      ]);

      const keyFiles = rankKeyFilesForFolder('src', graph, factsMap, 3);
      expect(keyFiles.length).toBeLessThanOrEqual(3);
      expect(keyFiles.length).toBeGreaterThan(0);

      // Key files should include server.ts or auth/jwt.ts
      const keyPaths = keyFiles.map((k) => k.path);
      expect(keyPaths).toContain('src/server.ts');
      expect(keyFiles[0]?.reason).toBeDefined();
      expect(typeof keyFiles[0]?.reason).toBe('string');
    });
  });
});
