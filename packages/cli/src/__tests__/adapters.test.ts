import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  detectAgents,
  generateAgentConfig,
  applyAgentConfigs,
  removeAgentConfigs,
  previewConfigDiff
} from '../adapters.js';

describe('Agent Adapters & Config Manifest (SPRINT-8.1)', () => {
  let tempRepo: string;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-adapters-repo-'));
  });

  afterEach(() => {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('detects installed agents based on workspace markers', () => {
    // Initially empty
    expect(detectAgents(tempRepo)).toEqual([]);

    // Create Cursor marker
    fs.mkdirSync(path.join(tempRepo, '.cursor'));
    expect(detectAgents(tempRepo)).toContain('cursor');

    // Create Claude Code marker
    fs.mkdirSync(path.join(tempRepo, '.claude'));
    expect(detectAgents(tempRepo)).toContain('claude');

    // Create Windsurf marker
    fs.writeFileSync(path.join(tempRepo, '.windsurfrules'), '# rules');
    expect(detectAgents(tempRepo)).toContain('windsurf');

    // Create Copilot marker
    fs.mkdirSync(path.join(tempRepo, '.github'));
    fs.writeFileSync(path.join(tempRepo, '.github', 'copilot-instructions.md'), '# instructions');
    expect(detectAgents(tempRepo)).toContain('copilot');

    // Create Aider marker
    fs.writeFileSync(path.join(tempRepo, '.aider.conf.yml'), 'model: gpt-4');
    expect(detectAgents(tempRepo)).toContain('aider');
  });

  it('generates config modifications and formatted diff preview', () => {
    const mod = generateAgentConfig('cursor', tempRepo);
    expect(mod.relPath).toBe('.cursor/mcp.json');
    expect(mod.content).toContain('orient');
    expect(mod.content).toContain('mcp');

    const diff = previewConfigDiff(mod);
    expect(diff).toContain('+');
    expect(diff).toContain('.cursor/mcp.json');
  });

  it('applies agent configs, records manifest, and configures MCP without clobbering existing configs', async () => {
    // Pre-create .cursor/mcp.json with an existing tool
    fs.mkdirSync(path.join(tempRepo, '.cursor'));
    const initialCursorConfig = JSON.stringify(
      {
        mcpServers: {
          existingTool: { command: 'node', args: ['existing.js'] }
        }
      },
      null,
      2
    );
    fs.writeFileSync(path.join(tempRepo, '.cursor', 'mcp.json'), initialCursorConfig, 'utf8');

    // Also simulate Claude
    fs.mkdirSync(path.join(tempRepo, '.claude'));

    const initResult = await applyAgentConfigs(tempRepo, { agents: ['cursor', 'claude'] });
    expect(initResult.success).toBe(true);
    expect(initResult.configuredAgents).toContain('cursor');
    expect(initResult.configuredAgents).toContain('claude');

    // Verify Cursor config preserves existingTool AND adds orient
    const updatedCursorConfig = JSON.parse(
      fs.readFileSync(path.join(tempRepo, '.cursor', 'mcp.json'), 'utf8')
    );
    expect(updatedCursorConfig.mcpServers.existingTool).toBeDefined();
    expect(updatedCursorConfig.mcpServers.orient).toBeDefined();
    expect(updatedCursorConfig.mcpServers.orient.command).toBe('orient');
    expect(updatedCursorConfig.mcpServers.orient.args).toEqual(['mcp']);

    // Verify Claude config was created
    expect(fs.existsSync(path.join(tempRepo, '.claude', 'mcp.json'))).toBe(true);

    // Verify Manifest exists
    const manifestPath = path.join(tempRepo, '.project', 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.entries.length).toBe(2);
  });

  it('cleanly removes agent configs and restores files to bit-for-bit original state', async () => {
    // Pre-create existing files with exact contents and hashes
    fs.mkdirSync(path.join(tempRepo, '.cursor'));
    const originalCursorContent = '{\n  "mcpServers": {\n    "custom": { "command": "run" }\n  }\n}\n';
    fs.writeFileSync(path.join(tempRepo, '.cursor', 'mcp.json'), originalCursorContent, 'utf8');
    const originalHash = crypto.createHash('sha256').update(originalCursorContent).digest('hex');

    // Create Claude directory (which has no existing mcp.json)
    fs.mkdirSync(path.join(tempRepo, '.claude'));

    // 1. Run init
    await applyAgentConfigs(tempRepo, { agents: ['cursor', 'claude'] });

    // 2. Run remove
    const removeResult = await removeAgentConfigs(tempRepo);
    expect(removeResult.success).toBe(true);
    expect(removeResult.revertedEntries.length).toBe(2);

    // 3. Verify bit-for-bit restoration of .cursor/mcp.json
    const restoredContent = fs.readFileSync(path.join(tempRepo, '.cursor', 'mcp.json'), 'utf8');
    expect(restoredContent).toBe(originalCursorContent);
    const restoredHash = crypto.createHash('sha256').update(restoredContent).digest('hex');
    expect(restoredHash).toBe(originalHash);

    // 4. Verify created file .claude/mcp.json was deleted
    expect(fs.existsSync(path.join(tempRepo, '.claude', 'mcp.json'))).toBe(false);

    // 5. Verify manifest file was removed
    expect(fs.existsSync(path.join(tempRepo, '.project', 'manifest.json'))).toBe(false);
  });
});
