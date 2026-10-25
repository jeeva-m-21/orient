#!/usr/bin/env node
import { Command } from 'commander';
import { getStatus, stopDaemon, runDoctor, runCiCheck } from './commands.js';
import { applyAgentConfigs, removeAgentConfigs, detectAgents, type SupportedAgent } from './adapters.js';
import { createOrientMcpServer, startDaemon } from '@orient/daemon';
import { openDatabase, initDatabase } from '@orient/core';
import path from 'node:path';
import os from 'node:os';

const program = new Command();
program
  .name('orient')
  .description('Local-first verified project map for humans & agents')
  .version('0.1.0');

program
  .command('open')
  .alias('start')
  .description('Start the Orient daemon and serve the web UI')
  .option('-p, --port <port>', 'Port to bind', '4477')
  .action(async (cmdOptions) => {
    const port = parseInt(cmdOptions.port, 10) || 4477;
    const configDir = path.join(os.homedir(), '.config', 'orient');
    const daemon = await startDaemon({
      port,
      host: '127.0.0.1',
      configDir,
      repoRoot: process.cwd()
    });
    console.log(`✓ Orient daemon started on http://127.0.0.1:${daemon.port} (PID: ${process.pid})`);
    console.log(`  Auth token: ${daemon.token}`);
    console.log(`  Web application: http://127.0.0.1:${daemon.port}/`);
    
    // Graceful shutdown listeners
    process.on('SIGINT', async () => {
      console.log('\nStopping Orient daemon...');
      await daemon.stop();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await daemon.stop();
      process.exit(0);
    });

    // Keep process running
    await new Promise(() => {});
  });

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

program
  .command('ci')
  .description('Headless CI/CD verification runner for project cards')
  .option('--max-outdated <threshold>', 'Maximum allowed ratio of outdated cards (e.g. 10%)', '15%')
  .option('--disallow-unreported <paths>', 'Comma-separated list of paths that must have fresh cards')
  .option('--format <format>', 'Output format: tap, junit, or json', 'tap')
  .action((cmdOptions) => {
    const configDir = path.join(os.homedir(), '.config', 'orient');
    const dbPath = path.join(configDir, 'orient.db');
    const orientDb = openDatabase(dbPath);
    initDatabase(orientDb.raw);

    const disallowList = cmdOptions.disallowUnreported
      ? cmdOptions.disallowUnreported.split(',').map((p: string) => p.trim())
      : undefined;

    const result = runCiCheck(orientDb, {
      maxOutdated: cmdOptions.maxOutdated,
      disallowUnreported: disallowList,
      format: cmdOptions.format,
      exportSnapshots: true,
      repoRoot: process.cwd()
    });

    console.log(result.reportOutput);
    if (!result.passed) {
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Install agent adapters and configure MCP for detected coding agents')
  .option('-a, --agent <agents...>', 'Explicit list of agents to configure (claude, cursor, windsurf, copilot, aider)')
  .action(async (cmdOptions) => {
    const cwd = process.cwd();
    const result = await applyAgentConfigs(cwd, {
      agents: cmdOptions.agent as SupportedAgent[] | undefined
    });

    if (result.configuredAgents.length === 0) {
      console.log('No supported AI coding agents detected in current workspace.');
      console.log('Detected agents: ' + (detectAgents(cwd).join(', ') || 'none'));
      return;
    }

    console.log('✓ Orient Agent MCP Configuration Initialized');
    console.log(`  Configured agents: ${result.configuredAgents.join(', ')}`);
    console.log(`  Manifest recorded: ${result.manifestPath}`);
    if (result.diffs.length > 0) {
      console.log('\nDiff Preview:');
      for (const d of result.diffs) {
        console.log(d);
      }
    }
  });

program
  .command('remove')
  .description('Cleanly revert all agent adapter modifications to bit-for-bit original state')
  .action(async () => {
    const cwd = process.cwd();
    const result = await removeAgentConfigs(cwd);
    if (result.success) {
      console.log(`✓ ${result.message}`);
    } else {
      console.error(`✗ ${result.message}`);
      process.exit(1);
    }
  });

program.parse();
