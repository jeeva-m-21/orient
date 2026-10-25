import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  getStatus,
  runDoctor,
  exportProjectCards
} from '../commands.js';
import { startDaemon, type DaemonInstance } from '@orient/daemon';
import { openDatabase, initDatabase, upsertCardRecord, type OrientDatabase } from '@orient/core';
import { nextjsGoldenCard } from '@orient/fixtures';

describe('CLI Commands & Diagnostics (SPRINT-4.5)', () => {
  let tempConfigDir: string;
  let tempRepo: string;
  let daemon: DaemonInstance | null = null;
  let orientDb: OrientDatabase;

  beforeEach(() => {
    tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-cli-cfg-'));
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-cli-repo-'));

    const dbPath = path.join(tempConfigDir, 'orient.db');
    orientDb = openDatabase(dbPath);
    initDatabase(orientDb.raw);
    upsertCardRecord(orientDb, {
      ...nextjsGoldenCard,
      path: '',
      level: 'repo'
    });
  });

  afterEach(async () => {
    if (daemon) {
      await daemon.stop();
      daemon = null;
    }
    if (orientDb && orientDb.raw.open) {
      orientDb.raw.close();
    }
    fs.rmSync(tempConfigDir, { recursive: true, force: true });
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('reports daemon running status when daemon is active', async () => {
    // When daemon is not running
    const stoppedStatus = await getStatus(tempConfigDir);
    expect(stoppedStatus.running).toBe(false);

    // Start daemon
    daemon = await startDaemon({
      port: 4495,
      host: '127.0.0.1',
      configDir: tempConfigDir,
      repoRoot: tempRepo
    });

    const runningStatus = await getStatus(tempConfigDir);
    expect(runningStatus.running).toBe(true);
    expect(runningStatus.port).toBe(daemon.port);
    expect(runningStatus.pid).toBe(process.pid);
  });

  it('runs doctor diagnostics validating node, git, port, and security boundaries', async () => {
    daemon = await startDaemon({
      port: 4496,
      host: '127.0.0.1',
      configDir: tempConfigDir,
      repoRoot: tempRepo
    });

    const report = await runDoctor({
      configDir: tempConfigDir,
      repoRoot: tempRepo
    });

    expect(report.ok).toBe(true);
    const checks = report.checks.map((c) => c.name);
    expect(checks).toContain('node_version');
    expect(checks).toContain('daemon_status');
    expect(checks).toContain('loopback_bind');
  });

  it('exports cards to AGENTS.md markdown and structured JSON formats', () => {
    const mdExport = exportProjectCards(orientDb, 'agents-md');
    expect(mdExport).toContain('# Project Map (Orient)');
    expect(mdExport).toContain('Next.js App Router e-commerce web application');

    const jsonExport = exportProjectCards(orientDb, 'json');
    const parsed = JSON.parse(jsonExport);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0].level).toBe('repo');
  });
});
