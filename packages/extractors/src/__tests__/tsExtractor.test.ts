import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getFixturePath } from '@orient/fixtures';
import { extractTypeScriptFacts } from '../index.js';

describe('TypeScript/JavaScript Language Extractor (SPRINT-2.2)', () => {
  it('extracts imports from ESM, CJS require, and dynamic import', () => {
    const code = `
      import { verifyToken, signToken } from './jwt.js';
      import express from 'express';
      const cors = require('cors');
      const db = await import('./db.js');
    `;

    const facts = extractTypeScriptFacts(code, 'src/server.ts');
    expect(facts.language).toBe('typescript');

    const sources = facts.imports.map((i) => i.source);
    expect(sources).toContain('./jwt.js');
    expect(sources).toContain('express');
    expect(sources).toContain('cors');
    expect(sources).toContain('./db.js');

    const jwtImport = facts.imports.find((i) => i.source === './jwt.js');
    expect(jwtImport?.specifiers).toContain('verifyToken');
    expect(jwtImport?.specifiers).toContain('signToken');

    const dbImport = facts.imports.find((i) => i.source === './db.js');
    expect(dbImport?.isDynamic).toBe(true);
  });

  it('extracts re-exports from barrel files as both dependencies and exports', () => {
    const code = `
      export * from './card.js';
      export { signToken, verifyToken as verify } from './jwt.js';
      export const VERSION = '1.0.0';
    `;

    const facts = extractTypeScriptFacts(code, 'src/index.ts');
    const sources = facts.imports.map((i) => i.source);
    expect(sources).toContain('./card.js');
    expect(sources).toContain('./jwt.js');

    const exports = facts.exports.map((e) => e.name);
    expect(exports).toContain('signToken');
    expect(exports).toContain('verify');
    expect(exports).toContain('VERSION');
  });

  it('extracts named and default exports for functions, classes, consts, types', () => {
    const code = `
      export function verifyAuthSession(token: string) { return true; }
      export class UserService {}
      export const API_PORT = 8080;
      export type SessionId = string;
      export interface UserSession { id: string; }
      export default function mainApp() {}
    `;

    const facts = extractTypeScriptFacts(code, 'src/auth.ts');
    const exportNames = facts.exports.map((e) => e.name);

    expect(exportNames).toContain('verifyAuthSession');
    expect(exportNames).toContain('UserService');
    expect(exportNames).toContain('API_PORT');
    expect(exportNames).toContain('SessionId');
    expect(exportNames).toContain('UserSession');
    expect(exportNames).toContain('default');

    const func = facts.exports.find((e) => e.name === 'verifyAuthSession');
    expect(func?.kind).toBe('function');

    const cls = facts.exports.find((e) => e.name === 'UserService');
    expect(cls?.kind).toBe('class');
  });

  it('extracts Express and Fastify style router mounts', () => {
    const code = `
      app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
      router.post('/api/auth/login', authController.login);
      fastify.delete('/api/items/:id', handler);
    `;

    const facts = extractTypeScriptFacts(code, 'src/routes.ts');
    expect(facts.routes).toHaveLength(3);

    expect(facts.routes).toContainEqual({
      method: 'GET',
      path: '/api/health',
      handlerRef: 'src/routes.ts'
    });
    expect(facts.routes).toContainEqual({
      method: 'POST',
      path: '/api/auth/login',
      handlerRef: 'src/routes.ts'
    });
    expect(facts.routes).toContainEqual({
      method: 'DELETE',
      path: '/api/items/:id',
      handlerRef: 'src/routes.ts'
    });
  });

  it('extracts Next.js App Router HTTP verb exports from route files', () => {
    const code = `
      import { verifyAuthSession } from '../../../lib/auth.js';

      export async function GET(request: Request) {
        return Response.json({ status: 'ok' });
      }

      export async function POST(request: Request) {
        return Response.json({ created: true });
      }
    `;

    // Next.js convention: route path derived from folder path if filePath ends with route.ts
    const facts = extractTypeScriptFacts(code, 'app/api/auth/route.ts');
    expect(facts.routes).toContainEqual({
      method: 'GET',
      path: '/api/auth',
      handlerRef: 'app/api/auth/route.ts'
    });
    expect(facts.routes).toContainEqual({
      method: 'POST',
      path: '/api/auth',
      handlerRef: 'app/api/auth/route.ts'
    });
  });

  it('extracts environment variables, ports, LOC, and TODO counts', () => {
    const code = `
      // TODO: add rate limiting to prevent brute force
      /* FIXME: validate token expiry */
      const secret = process.env.JWT_SECRET || 'dev_secret';
      const url = process.env['DATABASE_URL'];
      const port = 4477;
      app.listen(port);
      server.listen(3000);
    `;

    const facts = extractTypeScriptFacts(code, 'src/server.ts');
    expect(facts.envVars).toContain('JWT_SECRET');
    expect(facts.envVars).toContain('DATABASE_URL');
    expect(facts.ports).toContain(4477);
    expect(facts.ports).toContain(3000);
    expect(facts.todoCount).toBe(2);
    expect(facts.loc).toBeGreaterThan(5);
  });

  it('extracts facts directly from real Next.js fixture repository', () => {
    const nextjsRoot = getFixturePath('nextjs');
    const routeFile = path.join(nextjsRoot, 'app/api/auth/route.ts');
    const content = fs.readFileSync(routeFile, 'utf8');

    const facts = extractTypeScriptFacts(content, 'app/api/auth/route.ts');
    expect(facts.imports[0]?.source).toBe('../../../lib/auth.js');
    expect(facts.routes.map((r) => r.method)).toEqual(['GET', 'POST']);
    expect(facts.routes[0]?.path).toBe('/api/auth');
  });
});
