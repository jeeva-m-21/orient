import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  getStatus,
  runDoctor,
  exportProjectCards,
  runCiCheck
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

  describe('Headless CI/CD Runner (SPRINT-5.4)', () => {
    it('passes when card freshness is within threshold and critical paths are mapped', () => {
      const result = runCiCheck(orientDb, {
        maxOutdated: '10%',
        repoRoot: tempRepo,
        format: 'tap'
      });

      expect(result.passed).toBe(true);
      expect(result.outdatedPercentage).toBe(0);
      expect(result.reportOutput).toContain('ok 1');

      // Verifies auto-export snapshots
      expect(fs.existsSync(path.join(tempRepo, 'AGENTS.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempRepo, '.project', 'context.json'))).toBe(true);
    });

    it('fails when outdated cards exceed the specified threshold', () => {
      // Add outdated card
      upsertCardRecord(orientDb, {
        ...nextjsGoldenCard,
        id: 'card:folder:src/outdated',
        path: 'src/outdated',
        level: 'folder',
        state: 'Outdated'
      });

      // Total cards = 2, Outdated = 1 (50%)
      const result = runCiCheck(orientDb, {
        maxOutdated: '10%',
        format: 'json'
      });

      expect(result.passed).toBe(false);
      expect(result.outdatedPercentage).toBe(50);
      const parsedReport = JSON.parse(result.reportOutput);
      expect(parsedReport.passed).toBe(false);
    });

    it('fails when a path specified in --disallow-unreported is missing or outdated', () => {
      const result = runCiCheck(orientDb, {
        disallowUnreported: ['src/auth', 'src/billing'],
        format: 'junit'
      });

      expect(result.passed).toBe(false);
      expect(result.disallowedViolations.length).toBeGreaterThan(0);
      expect(result.reportOutput).toContain('<failure');
    });
  });
});
