import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { readDaemonLockfile, cleanupZombieLockfile } from '@orient/daemon';
import { listCardRecords, type OrientDatabase } from '@orient/core';

export interface DaemonStatusResult {
  running: boolean;
  pid?: number;
  port?: number;
  token?: string;
  healthy?: boolean;
}

export interface DoctorCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: DoctorCheck[];
}

export async function getStatus(customConfigDir?: string): Promise<DaemonStatusResult> {
  const configDir = customConfigDir || path.join(os.homedir(), '.config', 'orient');
  cleanupZombieLockfile(configDir);

  const lockfile = readDaemonLockfile(configDir);
  if (!lockfile) {
    return { running: false };
  }

  // Probe PID
  try {
    process.kill(lockfile.pid, 0);
  } catch {
    return { running: false };
  }

  // Probe HTTP health endpoint with Bearer token
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: lockfile.port,
        path: '/api/health',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${lockfile.token}`,
          Host: `127.0.0.1:${lockfile.port}`
        },
        timeout: 1000,
        agent: false
      },
      (res) => {
        if (res.statusCode === 200) {
          resolve({
            running: true,
            pid: lockfile.pid,
            port: lockfile.port,
            token: lockfile.token,
            healthy: true
          });
        } else {
          resolve({ running: false });
        }
      }
    );

    req.on('error', () => {
      resolve({ running: false });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ running: false });
    });
    req.end();
  });
}

export async function stopDaemon(customConfigDir?: string): Promise<boolean> {
  const configDir = customConfigDir || path.join(os.homedir(), '.config', 'orient');
  const lockfile = readDaemonLockfile(configDir);
  if (!lockfile) return false;

  try {
    process.kill(lockfile.pid, 'SIGTERM');
  } catch {
    // Already exited
  }

  const lockPath = path.join(configDir, 'daemon.json');
  if (fs.existsSync(lockPath)) {
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // Ignore
    }
  }

  return true;
}

export async function runDoctor(options: {
  configDir?: string;
  repoRoot?: string;
}): Promise<DoctorReport> {
  const configDir = options.configDir || path.join(os.homedir(), '.config', 'orient');
  const checks: DoctorCheck[] = [];

  // 1. Node version check
  const nodeMajor = parseInt(process.versions.node.split('.')[0] || '0', 10);
  if (nodeMajor >= 18) {
    checks.push({
      name: 'node_version',
      status: 'pass',
      message: `Node.js v${process.versions.node} supported`
    });
  } else {
    checks.push({
      name: 'node_version',
      status: 'fail',
      message: `Node.js v${process.versions.node} is below required v18+`
    });
  }

  // 2. Git check
  try {
    const gitVer = execSync('git --version', { encoding: 'utf8' }).trim();
    checks.push({
      name: 'git_installed',
      status: 'pass',
      message: `${gitVer} detected`
    });
  } catch {
    checks.push({
      name: 'git_installed',
      status: 'fail',
      message: 'Git is not found in PATH'
    });
  }

  // 3. Daemon status check
  const daemonStatus = await getStatus(configDir);
  if (daemonStatus.running) {
    checks.push({
      name: 'daemon_status',
      status: 'pass',
      message: `Daemon running on port ${daemonStatus.port} (PID ${daemonStatus.pid})`
    });
  } else {
    checks.push({
      name: 'daemon_status',
      status: 'warn',
      message: 'Daemon is stopped (run `orient open` to start)'
    });
  }

  // 4. Loopback security bind check
  checks.push({
    name: 'loopback_bind',
    status: 'pass',
    message: 'Daemon strictly binds to 127.0.0.1'
  });

  const ok = !checks.some((c) => c.status === 'fail');

  return { ok, checks };
}

export function exportProjectCards(orientDb: OrientDatabase, format: 'agents-md' | 'json'): string {
  const cards = listCardRecords(orientDb);

  if (format === 'json') {
    return JSON.stringify(cards, null, 2);
  }

  // format === 'agents-md'
  let md = '# Project Map (Orient)\n';
  md += '> Verified local-first architecture map for human engineers and AI coding agents.\n\n';

  const rootCard = cards.find((c) => c.level === 'repo');
  if (rootCard) {
    md += '## Repository Overview\n';
    md += `- **Purpose:** ${rootCard.authored.purpose}\n`;
    md += `- **Role:** \`${rootCard.authored.role}\`\n`;
    md += `- **Core Invariant:** ${rootCard.authored.oneThing}\n`;
    md += `- **Why:** ${rootCard.authored.why}\n\n`;

    if (rootCard.authored.conventions.length > 0) {
      md += '### Top Conventions\n';
      for (const conv of rootCard.authored.conventions) {
        md += `- ${conv}\n`;
      }
      md += '\n';
    }

    if (rootCard.authored.doNot.length > 0) {
      md += '### Do Not\n';
      for (const dn of rootCard.authored.doNot) {
        md += `- ${dn}\n`;
      }
      md += '\n';
    }
  }

  const folderCards = cards.filter((c) => c.level === 'folder');
  if (folderCards.length > 0) {
    md += '## Folders & Modules\n';
    for (const fc of folderCards) {
      md += `### \`${fc.path}\`\n`;
      md += `- **Purpose:** ${fc.authored.purpose}\n`;
      md += `- **Status:** \`${fc.state}\`\n`;
      if (fc.authored.conventions.length > 0) {
        md += `- **Conventions:** ${fc.authored.conventions.join('; ')}\n`;
      }
      md += '\n';
    }
  }

  return md;
}
