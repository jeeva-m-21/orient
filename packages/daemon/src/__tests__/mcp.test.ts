import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createOrientMcpServer } from '../mcp.js';
import { openDatabase, initDatabase, upsertCardRecord, type OrientDatabase } from '@orient/core';
import { nextjsGoldenCard } from '@orient/fixtures';
import type { Card } from '@orient/schema';

describe('Model Context Protocol (MCP) Tools (SPRINT-4.4)', () => {
  let tempDir: string;
  let dbPath: string;
  let orientDb: OrientDatabase;

  const repoCard: Card = {
    ...nextjsGoldenCard,
    id: 'orient:repo',
    path: '',
    level: 'repo',
    authored: {
      ...nextjsGoldenCard.authored,
      purpose: 'Next.js App Router e-commerce application',
      conventions: ['Server components by default', 'Edge API routes in app/api']
    }
  };

  const authFolderCard: Card = {
    ...nextjsGoldenCard,
    id: 'orient:app-api-auth',
    path: 'app/api/auth',
    level: 'folder',
    authored: {
      ...nextjsGoldenCard.authored,
      purpose: 'Authentication and session management routes',
      conventions: ['Verify JWT token on every route']
    }
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-mcp-test-'));
    dbPath = path.join(tempDir, 'orient.db');
    orientDb = openDatabase(dbPath);
    initDatabase(orientDb.raw);

    upsertCardRecord(orientDb, repoCard);
    upsertCardRecord(orientDb, authFolderCard);
  });

  afterEach(() => {
    if (orientDb && orientDb.raw.open) {
      orientDb.raw.close();
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('provides get_overview returning compact repo-level card and stack details', async () => {
    const mcp = createOrientMcpServer({
      orientDb,
      repoRoot: tempDir
    });

    const result = await mcp.executeTool('get_overview', {});
    expect(result.isError).toBeFalsy();
    const content = JSON.parse(result.content[0]?.text || '{}');
    expect(content.purpose).toBe('Next.js App Router e-commerce application');
    expect(content.conventions).toContain('Server components by default');
  });

  it('provides get_folder returning folder-level card with staleness status', async () => {
    const mcp = createOrientMcpServer({
      orientDb,
      repoRoot: tempDir
    });

    const result = await mcp.executeTool('get_folder', { path: 'app/api/auth' });
    expect(result.isError).toBeFalsy();
    const content = JSON.parse(result.content[0]?.text || '{}');
    expect(content.path).toBe('app/api/auth');
    expect(content.status).toBe('Fresh');
    expect(content.purpose).toContain('Authentication');
  });

  it('provides find_for_task performing lexical retrieval of relevant cards and conventions', async () => {
    const mcp = createOrientMcpServer({
      orientDb,
      repoRoot: tempDir
    });

    const result = await mcp.executeTool('find_for_task', { text: 'How do I authenticate JWT session?' });
    expect(result.isError).toBeFalsy();
    const content = JSON.parse(result.content[0]?.text || '{}');
    expect(content.matches.length).toBeGreaterThan(0);
    expect(content.matches[0]?.path).toBe('app/api/auth');
  });

  it('provides get_conventions retrieving area-specific coding conventions', async () => {
    const mcp = createOrientMcpServer({
      orientDb,
      repoRoot: tempDir
    });

    const result = await mcp.executeTool('get_conventions', { area: 'app/api' });
    expect(result.isError).toBeFalsy();
    const content = JSON.parse(result.content[0]?.text || '{}');
    expect(content.conventions).toContain('Verify JWT token on every route');
  });

  it('provides report tool allowing agents to submit verified updates through hard-gate validation', async () => {
    // Create physical file in temp repo so path passes existence check
    const authDir = path.join(tempDir, 'app', 'api', 'auth');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(path.join(authDir, 'route.ts'), 'export async function GET() {}');

    const mcp = createOrientMcpServer({
      orientDb,
      repoRoot: tempDir
    });

    const reportPayload = {
      agent: { name: 'Claude Code', sessionId: 'sess-mcp' },
      taskSummary: 'Added session token refresh logic',
      anchor: { commit: '1111222233334444555566667777888899990000' },
      items: [
        {
          path: 'app/api/auth',
          kind: 'modified',
          role: 'routes',
          why: 'Added session token refresh route handler'
        }
      ]
    };

    const result = await mcp.executeTool('report', { report: reportPayload });
    expect(result.isError).toBeFalsy();
    const content = JSON.parse(result.content[0]?.text || '{}');
    expect(content.accepted).toBe(true);
    expect(content.acceptedItems).toContain('app/api/auth');
  });
});
