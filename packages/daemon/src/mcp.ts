import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  getCardRecordByPath,
  listCardRecords,
  validateAgentReport,
  applyCardUpdate,
  PathMutex,
  AuditLogger,
  type OrientDatabase
} from '@orient/core';
import { ReportSchema, type Report } from '@orient/schema';
import type { EventBus } from './eventBus.js';
import fs from 'node:fs';
import path from 'node:path';

export interface McpServerOptions {
  orientDb: OrientDatabase;
  repoRoot: string;
  eventBus?: EventBus;
  auditLogger?: AuditLogger;
}

export interface McpToolResponse {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export interface OrientMcpServerInstance {
  server: McpServer;
  executeTool: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<McpToolResponse>;
  startStdio: () => Promise<void>;
}

export function createOrientMcpServer(options: McpServerOptions): OrientMcpServerInstance {
  const { orientDb, repoRoot, eventBus, auditLogger = new AuditLogger() } = options;
  const mutex = new PathMutex();

  const server = new McpServer({
    name: 'orient',
    version: '0.1.0'
  });

  const toolHandlers = new Map<
    string,
    (args: Record<string, unknown>) => Promise<McpToolResponse>
  >();

  // 1. Tool: get_overview
  const getOverviewHandler = async (): Promise<McpToolResponse> => {
    const rootCard = getCardRecordByPath(orientDb, '') || getCardRecordByPath(orientDb, '.');
    if (!rootCard) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              purpose: 'Repository overview (not yet indexed)',
              status: 'Unknown',
              conventions: []
            })
          }
        ]
      };
    }

    const payload = {
      purpose: rootCard.authored.purpose,
      role: rootCard.authored.role,
      why: rootCard.authored.why,
      oneThing: rootCard.authored.oneThing,
      conventions: rootCard.authored.conventions,
      decisions: rootCard.authored.decisions,
      keyFiles: rootCard.derived.keyFiles,
      status: rootCard.state,
      fileCount: rootCard.derived.fileCount,
      languages: rootCard.derived.languages
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }]
    };
  };

  server.tool('get_overview', 'Returns the compact repository map (~300 tokens)', {}, async () => {
    return getOverviewHandler();
  });
  toolHandlers.set('get_overview', getOverviewHandler);

  // 2. Tool: get_folder
  const getFolderHandler = async (args: Record<string, unknown>): Promise<McpToolResponse> => {
    const folderPath = String(args.path || '').replace(/\\/g, '/');
    const card = getCardRecordByPath(orientDb, folderPath);

    if (!card) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Folder card not found for: ${folderPath}` }) }]
      };
    }

    const payload = {
      path: card.path,
      level: card.level,
      status: card.state,
      version: card.version,
      purpose: card.authored.purpose,
      why: card.authored.why,
      oneThing: card.authored.oneThing,
      conventions: card.authored.conventions,
      decisions: card.authored.decisions,
      keyFiles: card.derived.keyFiles,
      surface: card.derived.surface
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }]
    };
  };

  server.tool(
    'get_folder',
    'Returns the card for a directory with purpose, conventions, and status',
    { path: z.string().describe('Folder path relative to repository root') },
    async (args) => {
      return getFolderHandler(args as Record<string, unknown>);
    }
  );
  toolHandlers.set('get_folder', getFolderHandler);

  // 3. Tool: get_file
  const getFileHandler = async (args: Record<string, unknown>): Promise<McpToolResponse> => {
    const filePath = String(args.path || '').replace(/\\/g, '/');
    const card = getCardRecordByPath(orientDb, filePath);

    if (!card) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `File card not found for: ${filePath}` }) }]
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(card, null, 2) }]
    };
  };

  server.tool(
    'get_file',
    'Returns the card for an individual file with exports and dependencies',
    { path: z.string().describe('File path relative to repository root') },
    async (args) => {
      return getFileHandler(args as Record<string, unknown>);
    }
  );
  toolHandlers.set('get_file', getFileHandler);

  // 4. Tool: find_for_task
  const findForTaskHandler = async (args: Record<string, unknown>): Promise<McpToolResponse> => {
    const query = String(args.text || '').toLowerCase();
    const queryTokens = query.split(/\W+/).filter((t) => t.length > 2);

    const allCards = listCardRecords(orientDb);
    const scored: Array<{ path: string; purpose: string; score: number; conventions: string[] }> = [];

    for (const card of allCards) {
      let score = 0;
      const searchable = [
        card.path,
        card.authored.purpose,
        card.authored.why,
        card.authored.oneThing,
        ...card.authored.conventions,
        ...card.authored.decisions.map((d) => `${d.choice} ${d.reason || ''}`)
      ]
        .join(' ')
        .toLowerCase();

      for (const token of queryTokens) {
        if (searchable.includes(token)) {
          score += 1;
        }
      }

      if (score > 0) {
        scored.push({
          path: card.path || '_root',
          purpose: card.authored.purpose,
          score,
          conventions: card.authored.conventions
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ matches: scored.slice(0, 5) }, null, 2)
        }
      ]
    };
  };

  server.tool(
    'find_for_task',
    'Lexical search matching cards and conventions relevant to a coding task',
    { text: z.string().describe('Task description or search terms') },
    async (args) => {
      return findForTaskHandler(args as Record<string, unknown>);
    }
  );
  toolHandlers.set('find_for_task', findForTaskHandler);

  // 5. Tool: get_conventions
  const getConventionsHandler = async (args: Record<string, unknown>): Promise<McpToolResponse> => {
    const area = String(args.area || '').replace(/\\/g, '/');
    const allCards = listCardRecords(orientDb);
    const conventionsSet = new Set<string>();

    for (const card of allCards) {
      if (!area || card.path.startsWith(area) || card.path === area || card.path === '') {
        for (const conv of card.authored.conventions) {
          conventionsSet.add(conv);
        }
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ area: area || 'global', conventions: Array.from(conventionsSet) }, null, 2)
        }
      ]
    };
  };

  server.tool(
    'get_conventions',
    'Returns conventions and architectural rules for a specific project area',
    { area: z.string().optional().describe('Area or folder prefix') },
    async (args) => {
      return getConventionsHandler(args as Record<string, unknown>);
    }
  );
  toolHandlers.set('get_conventions', getConventionsHandler);

  // 6. Tool: get_impact
  const getImpactHandler = async (args: Record<string, unknown>): Promise<McpToolResponse> => {
    const targetPath = String(args.path || '').replace(/\\/g, '/');

    const edges = orientDb.raw
      .prepare('SELECT from_path FROM import_edges WHERE to_path = ?')
      .all(targetPath) as Array<{ from_path: string }>;

    const dependents = edges.map((e) => e.from_path);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              path: targetPath,
              dependents,
              impactLevel: dependents.length > 5 ? 'high' : dependents.length > 0 ? 'medium' : 'low'
            },
            null,
            2
          )
        }
      ]
    };
  };

  server.tool(
    'get_impact',
    'Evaluates reverse dependencies and blast radius for a given path',
    { path: z.string().describe('File or folder path') },
    async (args) => {
      return getImpactHandler(args as Record<string, unknown>);
    }
  );
  toolHandlers.set('get_impact', getImpactHandler);

  // 7. Tool: report
  const reportHandler = async (args: Record<string, unknown>): Promise<McpToolResponse> => {
    const parsedReport = ReportSchema.parse(args.report as Report);

    // Scan known files in repo
    const knownFiles = new Set<string>();
    function walkDir(dir: string, base: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name === '.project') continue;
        const rel = path.join(base, e.name).replace(/\\/g, '/');
        if (e.isDirectory()) {
          walkDir(path.join(dir, e.name), rel);
        } else {
          knownFiles.add(rel);
        }
      }
    }
    walkDir(repoRoot, '');

    const outcome = validateAgentReport(parsedReport, {
      repoRoot,
      knownFiles
    });

    if (!outcome.result.accepted) {
      auditLogger.log({
        timestamp: new Date().toISOString(),
        eventType: 'validation_failure',
        agent: parsedReport.agent,
        projectPath: repoRoot,
        details: { rejectedReasons: outcome.result.rejectedItems }
      });

      eventBus?.emitEvent({
        type: 'report.received',
        payload: {
          agent: parsedReport.agent.name,
          accepted: false,
          rejectedReasons: outcome.result.rejectedItems.map((r) => r.reason)
        }
      });

      return {
        isError: true,
        content: [{ type: 'text' as const, text: JSON.stringify(outcome.result, null, 2) }]
      };
    }

    // Apply updates for each accepted item
    for (const item of outcome.sanitizedReport.items) {
      const existing = getCardRecordByPath(orientDb, item.path);
      if (existing) {
        await applyCardUpdate({
          orientDb,
          repoRoot,
          mutex,
          path: item.path,
          expectedVersion: existing.version,
          authoredUpdates: {
            why: item.why,
            role: item.role,
            decisions: item.decisions
          },
          agent: parsedReport.agent
        });

        eventBus?.emitEvent({
          type: 'card.updated',
          payload: {
            cardId: item.path,
            status: existing.state,
            source: 'agent-reported',
            version: existing.version + 1
          }
        });
      }
    }

    auditLogger.log({
      timestamp: new Date().toISOString(),
      eventType: 'report_ingestion',
      agent: parsedReport.agent,
      projectPath: repoRoot,
      details: { acceptedItems: outcome.result.acceptedItems }
    });

    eventBus?.emitEvent({
      type: 'report.received',
      payload: {
        agent: parsedReport.agent.name,
        accepted: true
      }
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(outcome.result, null, 2) }]
    };
  };

  server.tool(
    'report',
    'Submit agent work updates with hard gate validation',
    { report: z.any().describe('Agent report object') },
    async (args) => {
      return reportHandler(args as Record<string, unknown>);
    }
  );
  toolHandlers.set('report', reportHandler);

  const executeTool = async (name: string, args: Record<string, unknown>): Promise<McpToolResponse> => {
    const handler = toolHandlers.get(name);
    if (!handler) {
      throw new Error(`Unknown MCP tool: ${name}`);
    }
    return handler(args);
  };

  const startStdio = async (): Promise<void> => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  };

  return {
    server,
    executeTool,
    startStdio
  };
}
