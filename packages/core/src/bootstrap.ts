import { CardSchema, type Card, RoleEnum } from '@orient/schema';

export interface BootstrapContext {
  repoName: string;
  folders: string[];
  detectedStack?: string[];
  entryPoints?: string[];
  ports?: number[];
}

export interface ParseAgentResult {
  cards: Card[];
  errors: string[];
}

export const GOLDEN_EXAMPLE_CARD: Card = {
  id: 'card:folder:src/auth',
  level: 'folder',
  path: 'src/auth',
  version: 1,
  state: 'Fresh',
  derived: {
    fileCount: 4,
    loc: 180,
    languages: ['typescript'],
    keyFiles: [
      { path: 'src/auth/jwt.ts', reason: 'Primary authentication handler' }
    ],
    dependsOn: ['src/config', 'src/db'],
    usedBy: [],
    surface: {
      routes: [
        { method: 'POST', path: '/auth/login', handlerRef: 'src/auth/routes.ts' }
      ],
      exports: ['authRoutes'],
      envVars: ['JWT_SECRET'],
      tables: ['users'],
      ports: [4477]
    },
    tests: {
      present: true,
      paths: ['src/auth/__tests__/jwt.test.ts']
    },
    health: {
      lastChanged: '2026-10-25T12:00:00Z',
      todoCount: 0,
      hasTests: true
    }
  },
  authored: {
    purpose: 'Authentication and JWT token session management endpoints',
    role: 'routes',
    why: 'Enforces token verification and session rotation across all API calls',
    oneThing: 'Never store sensitive tokens in unencrypted client storage',
    conventions: ['Export handlers as async functions', 'Enforce Bearer token verification'],
    doNot: ['Never commit hardcoded secrets or JWT tokens'],
    decisions: [
      {
        choice: 'JWT bearer tokens with HS256 signing',
        reason: 'Stateless authentication across microservices'
      }
    ],
    representativeFile: {
      path: 'src/auth/jwt.ts',
      snippetRange: [1, 20]
    }
  },
  meta: {
    source: 'agent-reported',
    agent: {
      name: 'bootstrap-agent',
      color: '#3B82F6'
    },
    confidence: 'high',
    evidence: [],
    anchor: {
      commit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
    },
    pinned: false,
    createdAt: '2026-10-25T12:00:00Z',
    updatedAt: '2026-10-25T12:00:00Z'
  }
};

/**
 * Generates a structured bootstrap prompt for AI coding agents (Claude Code, Cursor, Windsurf)
 * to inspect unmapped folders and generate initial verified Orient cards.
 */
export function generateBootstrapPrompt(context: BootstrapContext): string {
  const allowedRoles = RoleEnum.options.join(', ');
  const stackSummary = context.detectedStack?.length ? context.detectedStack.join(', ') : 'Not detected';
  const entryPointsSummary = context.entryPoints?.length ? context.entryPoints.join(', ') : 'None detected';
  const portsSummary = context.ports?.length ? context.ports.join(', ') : 'None detected';
  const folderList = context.folders.map((f) => `- \`${f}\``).join('\n');

  return `# Orient Project Map — Cold Start Bootstrap Request

You are assisting with the initial cold-start mapping of the repository **${context.repoName}**.
Orient maintains a verified dual-audience project map eliminating comprehension debt for humans and providing structured memory for coding agents.

## Repository Overview
- **Name:** ${context.repoName}
- **Detected Stack:** ${stackSummary}
- **Entry Points:** ${entryPointsSummary}
- **Detected Ports:** ${portsSummary}

## Directories to Inspect
The following key directories require initial card mapping:
${folderList}

## Instructions for Each Directory
1. Inspect the contents and architecture of each directory listed above.
2. Formulate concise, accurate architectural claims:
   - **role**: Choose strictly from: \`${allowedRoles}\`.
   - **purpose**: One concise sentence describing what this directory does and why it exists (strictly <= 140 characters).
   - **conventions**: Important team patterns, naming conventions, or invariants (strictly <= 200 characters).
   - **keyFiles**: 1 to 5 most central or representative files in this directory.
   - **dependencies**: Other internal directories or modules this directory depends on.
3. Submit each card either by:
   - Writing the card JSON to \`.project/cards/<path-slug>.json\` (e.g. \`.project/cards/src-auth.json\`).
   - Or submitting via the Orient MCP server \`report\` tool.

## Strict Card Schema Specification
Each card must strictly conform to the following JSON structure:

\`\`\`json
${JSON.stringify(GOLDEN_EXAMPLE_CARD, null, 2)}
\`\`\`

## Non-Negotiable Hard Gate Rules
- **Anti-Hallucination:** All \`keyFiles\` and \`tests\` MUST exist in the repository working tree.
- **Strict Blacklist:** NEVER mention, read, or report secrets, passwords, or files matching \`.env*\`, \`*.pem\`, \`id_rsa\`.
- **Length Bounds:** Cards violating the 140-character purpose limit or 200-character conventions limit will be automatically rejected.
`;
}

/**
 * Parses markdown or text output from an AI agent containing JSON blocks
 * and extracts validated Card objects.
 */
export function parseAgentCardResponse(responseText: string): ParseAgentResult {
  const cards: Card[] = [];
  const errors: string[] = [];

  // Match JSON code blocks (```json ... ```) or bare JSON array/objects
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  let match: RegExpExecArray | null;
  const jsonCandidates: string[] = [];

  while ((match = jsonBlockRegex.exec(responseText)) !== null) {
    if (match[1]) {
      jsonCandidates.push(match[1].trim());
    }
  }

  // If no fenced blocks found, check if the entire response is a JSON payload
  if (jsonCandidates.length === 0 && (responseText.trim().startsWith('{') || responseText.trim().startsWith('['))) {
    jsonCandidates.push(responseText.trim());
  }

  for (const rawJson of jsonCandidates) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const validated = CardSchema.safeParse(item);
          if (validated.success) {
            cards.push(validated.data);
          } else {
            errors.push(`Validation failure for item: ${validated.error.message}`);
          }
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        const validated = CardSchema.safeParse(parsed);
        if (validated.success) {
          cards.push(validated.data);
        } else {
          errors.push(`Validation failure for card ${parsed.path || 'unknown'}: ${validated.error.message}`);
        }
      }
    } catch (err: unknown) {
      errors.push(`JSON parsing error: ${(err as Error).message}`);
    }
  }

  return { cards, errors };
}
