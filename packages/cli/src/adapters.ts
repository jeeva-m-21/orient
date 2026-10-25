import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type SupportedAgent = 'claude' | 'cursor' | 'windsurf' | 'copilot' | 'aider';

export interface ConfigModification {
  agent: SupportedAgent;
  relPath: string;
  absPath: string;
  isNew: boolean;
  content: string;
  beforeContent: string | null;
  beforeHash: string | null;
}

export interface ConfigEntryRecord {
  path: string;
  wasCreated: boolean;
  beforeHash: string | null;
  beforeContent: string | null;
  insertedBlockId?: string;
}

export interface ConfigManifest {
  version: 1;
  installedAt: string;
  entries: ConfigEntryRecord[];
}

export interface InitResult {
  success: boolean;
  configuredAgents: SupportedAgent[];
  manifestPath: string;
  diffs: string[];
}

export interface RemoveResult {
  success: boolean;
  revertedEntries: string[];
  message: string;
}

/**
 * Detects installed agents based on files and folders in the workspace.
 */
export function detectAgents(repoRoot: string): SupportedAgent[] {
  const detected: SupportedAgent[] = [];

  // Claude Code
  if (
    fs.existsSync(path.join(repoRoot, '.claude')) ||
    fs.existsSync(path.join(repoRoot, '.claude.json'))
  ) {
    detected.push('claude');
  }

  // Cursor
  if (
    fs.existsSync(path.join(repoRoot, '.cursor')) ||
    fs.existsSync(path.join(repoRoot, '.cursorrules'))
  ) {
    detected.push('cursor');
  }

  // Windsurf
  if (
    fs.existsSync(path.join(repoRoot, '.windsurf')) ||
    fs.existsSync(path.join(repoRoot, '.windsurfrules'))
  ) {
    detected.push('windsurf');
  }

  // Copilot
  if (
    fs.existsSync(path.join(repoRoot, '.github', 'copilot-instructions.md')) ||
    fs.existsSync(path.join(repoRoot, '.github'))
  ) {
    detected.push('copilot');
  }

  // Aider
  if (
    fs.existsSync(path.join(repoRoot, '.aider.conf.yml')) ||
    fs.existsSync(path.join(repoRoot, '.aider'))
  ) {
    detected.push('aider');
  }

  return detected;
}

function hashString(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generates configuration modification for a specific agent.
 */
export function generateAgentConfig(agent: SupportedAgent, repoRoot: string): ConfigModification {
  let relPath: string;

  switch (agent) {
    case 'claude':
      relPath = '.claude/mcp.json';
      break;
    case 'cursor':
      relPath = '.cursor/mcp.json';
      break;
    case 'windsurf':
      relPath = '.windsurf/mcp_config.json';
      break;
    case 'copilot':
      relPath = '.github/copilot-instructions.md';
      break;
    case 'aider':
      relPath = '.aider.conf.yml';
      break;
  }

  const absPath = path.join(repoRoot, relPath);
  const exists = fs.existsSync(absPath);
  const beforeContent = exists ? fs.readFileSync(absPath, 'utf8') : null;
  const beforeHash = beforeContent ? hashString(beforeContent) : null;

  let newContent = '';

  if (agent === 'claude' || agent === 'cursor' || agent === 'windsurf') {
    let baseJson: { mcpServers?: Record<string, unknown> } = {};
    if (beforeContent) {
      try {
        baseJson = JSON.parse(beforeContent);
      } catch {
        baseJson = {};
      }
    }
    const mergedJson = {
      ...baseJson,
      mcpServers: {
        ...(baseJson.mcpServers || {}),
        orient: {
          command: 'orient',
          args: ['mcp']
        }
      }
    };
    newContent = JSON.stringify(mergedJson, null, 2) + '\n';
  } else if (agent === 'copilot') {
    const copilotSnippet =
      '\n<!-- ORIENT:START -->\n# Orient Project Map\nOrient provides real-time architectural context via MCP.\n<!-- ORIENT:END -->\n';
    newContent = beforeContent ? beforeContent + copilotSnippet : copilotSnippet.trimStart();
  } else if (agent === 'aider') {
    const aiderSnippet =
      '\n# Orient MCP integration\nread: [AGENTS.md]\n';
    newContent = beforeContent ? beforeContent + aiderSnippet : aiderSnippet.trimStart();
  }

  return {
    agent,
    relPath,
    absPath,
    isNew: !exists,
    content: newContent,
    beforeContent,
    beforeHash
  };
}

/**
 * Formats a visual unified diff preview of configuration changes before applying.
 */
export function previewConfigDiff(mod: ConfigModification): string {
  const lines: string[] = [];
  lines.push(`--- a/${mod.relPath}`);
  lines.push(`+++ b/${mod.relPath}`);

  if (mod.isNew) {
    lines.push('@@ -0,0 +1 @@');
    for (const line of mod.content.split('\n')) {
      if (line) lines.push(`+ ${line}`);
    }
  } else {
    lines.push('@@ -1 +1 @@');
    const oldLines = (mod.beforeContent || '').split('\n');
    const newLines = mod.content.split('\n');
    for (const line of newLines) {
      if (!oldLines.includes(line) && line) {
        lines.push(`+ ${line}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Applies configurations for detected (or selected) agents and writes config manifest.
 */
export async function applyAgentConfigs(
  repoRoot: string,
  options: { agents?: SupportedAgent[]; force?: boolean } = {}
): Promise<InitResult> {
  const targetAgents =
    options.agents && options.agents.length > 0 ? options.agents : detectAgents(repoRoot);

  const configuredAgents: SupportedAgent[] = [];
  const entries: ConfigEntryRecord[] = [];
  const diffs: string[] = [];

  for (const agent of targetAgents) {
    const mod = generateAgentConfig(agent, repoRoot);
    diffs.push(previewConfigDiff(mod));

    const dir = path.dirname(mod.absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(mod.absPath, mod.content, 'utf8');

    entries.push({
      path: mod.relPath,
      wasCreated: mod.isNew,
      beforeHash: mod.beforeHash,
      beforeContent: mod.beforeContent
    });

    configuredAgents.push(agent);
  }

  // Write .project/manifest.json
  const projectDir = path.join(repoRoot, '.project');
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  const manifestPath = path.join(projectDir, 'manifest.json');
  const manifest: ConfigManifest = {
    version: 1,
    installedAt: new Date().toISOString(),
    entries
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {
    success: true,
    configuredAgents,
    manifestPath,
    diffs
  };
}

/**
 * Cleanly removes configurations using manifest and restores bit-for-bit previous file content.
 */
export async function removeAgentConfigs(repoRoot: string): Promise<RemoveResult> {
  const manifestPath = path.join(repoRoot, '.project', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return {
      success: false,
      revertedEntries: [],
      message: 'No config manifest found in .project/manifest.json'
    };
  }

  let manifest: ConfigManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err: unknown) {
    return {
      success: false,
      revertedEntries: [],
      message: `Failed to parse manifest: ${err instanceof Error ? err.message : String(err)}`
    };
  }

  const revertedEntries: string[] = [];

  for (const entry of manifest.entries) {
    const absPath = path.join(repoRoot, entry.path);

    if (entry.wasCreated) {
      if (fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
      }
      // Clean up empty directory if applicable
      const parentDir = path.dirname(absPath);
      try {
        if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
          fs.rmdirSync(parentDir);
        }
      } catch {
        // Ignore
      }
    } else if (entry.beforeContent !== null) {
      // Bit-for-bit restore
      fs.writeFileSync(absPath, entry.beforeContent, 'utf8');
    }

    revertedEntries.push(entry.path);
  }

  // Remove manifest
  try {
    fs.unlinkSync(manifestPath);
  } catch {
    // Ignore
  }

  return {
    success: true,
    revertedEntries,
    message: `Cleanly reverted ${revertedEntries.length} configuration files to bit-for-bit original state.`
  };
}
