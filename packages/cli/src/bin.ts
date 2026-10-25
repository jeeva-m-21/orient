#!/usr/bin/env node
import { Command } from 'commander';
import { getStatus, stopDaemon, runDoctor } from './commands.js';
import { createOrientMcpServer } from '@orient/daemon';
import { openDatabase, initDatabase } from '@orient/core';
import path from 'node:path';
import os from 'node:os';

const program = new Command();
program
  .name('orient')
  .description('Local-first verified project map for humans & agents')
  .version('0.1.0');

program
  .command('status')
  .description('Report daemon status and port')
  .action(async () => {
    const status = await getStatus();
    if (status.running) {
      console.log(`Orient daemon is running on http://127.0.0.1:${status.port} (PID: ${status.pid})`);
    } else {
      console.log('Orient daemon is stopped.');
    }
  });

program
  .command('stop')
  .description('Stop running Orient daemon')
  .action(async () => {
    const stopped = await stopDaemon();
    if (stopped) {
      console.log('Orient daemon stopped.');
    } else {
      console.log('Orient daemon is not running.');
    }
  });

program
  .command('doctor')
  .description('Run system and daemon diagnostics')
  .action(async () => {
    const report = await runDoctor({});
    console.log(report.ok ? '✓ Orient Doctor: All checks passed' : '⚠ Orient Doctor: Warnings found');
    for (const c of report.checks) {
      const icon = c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : '✗';
      console.log(`  ${icon} [${c.name}]: ${c.message}`);
    }
  });

program
  .command('mcp')
  .description('Run MCP server over stdio for AI coding agents')
  .action(async () => {
    const configDir = path.join(os.homedir(), '.config', 'orient');
    const dbPath = path.join(configDir, 'orient.db');
    const orientDb = openDatabase(dbPath);
    initDatabase(orientDb.raw);
    const mcp = createOrientMcpServer({
      orientDb,
      repoRoot: process.cwd()
    });
    await mcp.startStdio();
  });

program.parse();
