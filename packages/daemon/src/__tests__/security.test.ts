import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { startDaemon, type DaemonInstance } from '../lifecycle.js';

function requestWithRawHeaders(options: {
  port: number;
  path: string;
  headers: Record<string, string>;
}): Promise<{ status: number; body: { status?: string; error?: string; port?: number } }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: options.port,
        path: options.path,
        method: 'GET',
        headers: options.headers,
        agent: false
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode || 0, body: { error: data } });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('Layer 1 Entry Security & Path Traversal Guards (SPRINT-4.2)', () => {
  let tempConfigDir: string;
  let tempRepo: string;
  let daemon: DaemonInstance;

  beforeEach(async () => {
    tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-sec-cfg-'));
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-sec-repo-'));
    // Create a safe sample file
    fs.writeFileSync(path.join(tempRepo, 'index.ts'), 'export const HELLO = 1;\n');

    daemon = await startDaemon({
      port: 4480,
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

  it('rejects unauthenticated requests without bearer token with 401 Unauthorized', async () => {
    const res = await requestWithRawHeaders({
      port: daemon.port,
      path: '/api/health',
      headers: { Host: `127.0.0.1:${daemon.port}` }
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Unauthorized');
  });

  it('accepts requests with valid cryptographic Bearer token', async () => {
    const res = await requestWithRawHeaders({
      port: daemon.port,
      path: '/api/health',
      headers: {
        Authorization: `Bearer ${daemon.token}`,
        Host: `127.0.0.1:${daemon.port}`
      }
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.port).toBe(daemon.port);
  });

  it('blocks DNS rebinding attacks with unrecognized Host header with 403 Forbidden', async () => {
    const res = await requestWithRawHeaders({
      port: daemon.port,
      path: '/api/health',
      headers: {
        Authorization: `Bearer ${daemon.token}`,
        Host: 'evil-attacker-website.com'
      }
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Invalid Host header');
  });

  it('blocks cross-site requests with foreign Origin header with 403 Forbidden', async () => {
    const res = await requestWithRawHeaders({
      port: daemon.port,
      path: '/api/health',
      headers: {
        Authorization: `Bearer ${daemon.token}`,
        Host: `127.0.0.1:${daemon.port}`,
        Origin: 'https://malicious-site.com'
      }
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Invalid Origin');
  });

  it('blocks path traversal attempts attempting to escape repository root with 403 Forbidden', async () => {
    const res = await requestWithRawHeaders({
      port: daemon.port,
      path: '/api/code?path=../../etc/passwd',
      headers: {
        Authorization: `Bearer ${daemon.token}`,
        Host: `127.0.0.1:${daemon.port}`
      }
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('escapes repository boundary');
  });
});
