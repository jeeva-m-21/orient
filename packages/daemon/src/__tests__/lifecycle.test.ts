import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  startDaemon,
  readDaemonLockfile,
  cleanupZombieLockfile,
  type DaemonInstance
} from '../lifecycle.js';

describe('Fastify Daemon Lifecycle & Zombie Cleanup (SPRINT-4.1)', () => {
  let tempConfigDir: string;
  let tempRepo: string;
  let daemon: DaemonInstance | null = null;

  beforeEach(() => {
    tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-daemon-cfg-'));
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-daemon-repo-'));
  });

  afterEach(async () => {
    if (daemon) {
      await daemon.stop();
      daemon = null;
    }
    fs.rmSync(tempConfigDir, { recursive: true, force: true });
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('starts daemon on loopback 127.0.0.1 with 32-byte cryptographic token and writes 0600 lockfile', async () => {
    daemon = await startDaemon({
      port: 4477,
      host: '127.0.0.1',
      configDir: tempConfigDir,
      repoRoot: tempRepo
    });

    expect(daemon.port).toBeGreaterThanOrEqual(4477);
    expect(daemon.token).toMatch(/^[a-f0-9]{64}$/); // 32-byte hex token

    const lockfilePath = path.join(tempConfigDir, 'daemon.json');
    expect(fs.existsSync(lockfilePath)).toBe(true);

    const lockData = readDaemonLockfile(tempConfigDir);
    expect(lockData).not.toBeNull();
    expect(lockData?.pid).toBe(process.pid);
    expect(lockData?.port).toBe(daemon.port);
    expect(lockData?.token).toBe(daemon.token);

    // Verify 0600 mode on POSIX
    if (process.platform !== 'win32') {
      const stat = fs.statSync(lockfilePath);
      expect((stat.mode & 0o777)).toBe(0o600);
    }
  });

  it('detects and cleans up zombie lockfiles from dead processes', async () => {
    const lockfilePath = path.join(tempConfigDir, 'daemon.json');
    // Write fake lockfile with impossible/dead PID (e.g. 99999999)
    const deadPid = 99999999;
    fs.writeFileSync(
      lockfilePath,
      JSON.stringify({
        pid: deadPid,
        port: 4477,
        token: 'deadbeef'.repeat(8),
        startedAt: new Date().toISOString()
      }),
      'utf8'
    );

    const wasCleaned = cleanupZombieLockfile(tempConfigDir);
    expect(wasCleaned).toBe(true);
    expect(fs.existsSync(lockfilePath)).toBe(false);

    // Now startDaemon succeeds cleanly
    daemon = await startDaemon({
      port: 4477,
      host: '127.0.0.1',
      configDir: tempConfigDir,
      repoRoot: tempRepo
    });
    expect(daemon.isRunning).toBe(true);
  });

  it('arbitrates ports when the default port is occupied', async () => {
    // Start first daemon on 4477
    daemon = await startDaemon({
      port: 4477,
      host: '127.0.0.1',
      configDir: tempConfigDir,
      repoRoot: tempRepo
    });

    const secondConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-daemon-cfg2-'));
    try {
      // Start second daemon with same default port 4477 -> should arbitrate to 4478
      const secondDaemon = await startDaemon({
        port: 4477,
        host: '127.0.0.1',
        configDir: secondConfigDir,
        repoRoot: tempRepo
      });

      expect(secondDaemon.port).toBe(4478);
      await secondDaemon.stop();
    } finally {
      fs.rmSync(secondConfigDir, { recursive: true, force: true });
    }
  });

  it('shuts down cleanly and removes lockfile on stop()', async () => {
    daemon = await startDaemon({
      port: 4477,
      host: '127.0.0.1',
      configDir: tempConfigDir,
      repoRoot: tempRepo
    });

    const lockfilePath = path.join(tempConfigDir, 'daemon.json');
    expect(fs.existsSync(lockfilePath)).toBe(true);

    await daemon.stop();
    expect(daemon.isRunning).toBe(false);
    expect(fs.existsSync(lockfilePath)).toBe(false);
    daemon = null;
  });
});
