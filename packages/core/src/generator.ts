import {
  type Card,
  type DerivedData,
  CardSchema,
  RoleEnum,
  type Role
} from '@orient/schema';

export interface DeterministicBrief {
  path: string;
  level: 'repo' | 'folder' | 'file';
  languages: string[];
  keyFiles: string[];
  routes: string[];
  exports: string[];
  envVars: string[];
  dependencies: string[];
  fileCount?: number;
  loc?: number;
  tests?: string[];
}

export interface BuildBriefOptions {
  path: string;
  level: 'repo' | 'folder' | 'file';
  derived: DerivedData;
  previousCard?: Card;
  gitDiff?: string;
}

export interface CriticPassResult {
  card: Card;
  strippedClaims: string[];
}

export type GeneratorBackend = 'heuristic' | 'ollama' | 'custom';

export interface CardGenerationOptions {
  path: string;
  level: 'repo' | 'folder' | 'file';
  derived: DerivedData;
  backend?: GeneratorBackend;
  model?: string;
  ollamaUrl?: string;
  provider?: (prompt: string) => Promise<string>;
  commit: string;
  cacheKey?: string;
  previousCard?: Card;
}

const GENERATOR_CACHE = new Map<string, Card>();

/**
 * Constructs a compact, deterministic brief containing AST facts, exported surfaces,
 * and key files without embedding any source code.
 */
export function buildDeterministicBrief(options: BuildBriefOptions): DeterministicBrief {
  const { path, level, derived } = options;

  const keyFiles = derived.keyFiles.map((kf) => kf.path);
  const routes = derived.surface.routes.map((r) => `${r.method} ${r.path}`);
  const exportsList = [...derived.surface.exports];
  const envVars = [...derived.surface.envVars];
  const dependencies = [...derived.dependsOn];
  const tests = [...derived.tests.paths];

  return {
    path,
    level,
    languages: derived.languages,
    keyFiles,
    routes,
    exports: exportsList,
    envVars,
    dependencies,
    fileCount: derived.fileCount,
    loc: derived.loc,
    tests
  };
}

/**
 * Critic pass: strips unsupported sentences, non-existent files, and hallucinated routes,
 * and enforces strict field lengths on generated cards.
 */
export function criticPass(card: Card, brief: DeterministicBrief): CriticPassResult {
  const strippedClaims: string[] = [];

  const verifiedFiles = new Set([...brief.keyFiles, ...(brief.tests || [])]);
  const verifiedRoutes = new Set(brief.routes.map((r) => r.toLowerCase()));

  // Filter conventions
  const filteredConventions: string[] = [];
  for (const conv of card.authored.conventions) {
    // Check if convention references a non-existent code file (.ts, .js, .py, etc.)
    const fileMatches = conv.match(/[\w./-]+\.(?:ts|tsx|js|jsx|py|go|rs|json)/g);
    let hasHallucinatedFile = false;
    if (fileMatches) {
      for (const f of fileMatches) {
        const basename = f.split('/').pop() || f;
        const exists = Array.from(verifiedFiles).some((vf) => vf.endsWith(f) || vf.endsWith(basename));
        if (!exists) {
          hasHallucinatedFile = true;
          break;
        }
      }
    }

    // Check if convention references a non-existent API route (/api/..., /auth/..., etc.)
    const routeMatches = conv.match(/(?:GET|POST|PUT|DELETE|PATCH)\s+[\w./-]+|\/[\w/-]{3,}/gi);
    let hasHallucinatedRoute = false;
    if (routeMatches) {
      for (const r of routeMatches) {
        const normalized = r.trim().toLowerCase();
        // Skip common web tech words like /json, /src
        if (normalized === '/src' || normalized === '/json') continue;
        const matched = Array.from(verifiedRoutes).some((vr) => vr.includes(normalized));
        if (!matched && (normalized.startsWith('get ') || normalized.startsWith('post ') || normalized.startsWith('/api/'))) {
          hasHallucinatedRoute = true;
          break;
        }
      }
    }

    if (hasHallucinatedFile || hasHallucinatedRoute) {
      strippedClaims.push(conv);
    } else {
      filteredConventions.push(conv);
    }
  }

  // Enforce string length bounds
  let purpose = card.authored.purpose;
  if (purpose.length > 140) {
    purpose = purpose.slice(0, 137).trim() + '...';
  }

  let why = card.authored.why;
  if (why.length > 200) {
    why = why.slice(0, 197).trim() + '...';
  }

  let oneThing = card.authored.oneThing;
  const words = oneThing.trim().split(/\s+/);
  if (words.length > 12) {
    oneThing = words.slice(0, 12).join(' ');
  }

  const cleanedCard: Card = {
    ...card,
    authored: {
      ...card.authored,
      purpose,
      why,
      oneThing,
      conventions: filteredConventions
    }
  };

  return {
    card: cleanedCard,
    strippedClaims
  };
}

/**
 * Heuristically infers card role and content directly from AST facts when no LLM is configured.
 */
function generateHeuristicCard(
  options: CardGenerationOptions,
  brief: DeterministicBrief
): Card {
  let role: Role = 'services';
  const p = options.path.toLowerCase();

  if (p.includes('route') || p.includes('api') || brief.routes.length > 0) {
    role = 'routes';
  } else if (p.includes('controller')) {
    role = 'controllers';
  } else if (p.includes('model') || p.includes('schema') || p.includes('entity')) {
    role = 'models';
  } else if (p.includes('test') || p.includes('__test__')) {
    role = 'tests';
  } else if (p.includes('ui') || p.includes('component')) {
    role = 'ui-components';
  } else if (p.includes('page') || p.includes('view')) {
    role = 'ui-pages';
  } else if (p.includes('config')) {
    role = 'config';
  } else if (p.includes('script') || p.includes('tool')) {
    role = 'scripts';
  } else if (p === '' || p === '.') {
    role = 'entrypoint';
  }

  const exportsSummary = brief.exports.slice(0, 2).join(', ');
  const purpose = exportsSummary
    ? `${options.path || 'Root'} subsystem exporting ${exportsSummary}.`
    : `${options.path || 'Root'} architectural subsystem.`;

  const safePurpose = purpose.length > 140 ? purpose.slice(0, 137) + '...' : purpose;
  const why = `Provides modular functionality for ${options.path || 'the project'}.`;
  const oneThing = `Keep dependencies strictly isolated within ${options.path || 'this area'}.`;

  const conventions: string[] = [];
  if (brief.languages.includes('typescript')) {
    conventions.push('Use strict TypeScript types; avoid untyped escapes');
  }
  if (brief.tests && brief.tests.length > 0) {
    conventions.push('Maintain unit tests for all public module exports');
  }

  const card: Card = {
    id: `card:${options.level}:${options.path}`,
    level: options.level,
    path: options.path,
    version: 1,
    state: 'Fresh',
    derived: options.derived,
    authored: {
      purpose: safePurpose,
      role,
      why,
      oneThing,
      conventions,
      doNot: ['Never commit secrets, credentials, or .env files'],
      decisions: []
    },
    meta: {
      source: 'generated',
      confidence: 'medium',
      evidence: [],
      anchor: {
        commit: options.commit
      },
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };

  return card;
}

/**
 * Generates an Orient card using the configured backend (heuristic fallback, local Ollama, or custom provider),
 * executes the critic pass, and caches the result.
 */
export async function generateCardWithBackend(options: CardGenerationOptions): Promise<Card> {
  const cacheKey = options.cacheKey || `${options.path}:${options.commit}`;
  const cached = GENERATOR_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const brief = buildDeterministicBrief({
    path: options.path,
    level: options.level,
    derived: options.derived,
    previousCard: options.previousCard
  });

  const backend = options.backend || 'heuristic';
  let rawCard: Card;

  if (backend === 'heuristic') {
    rawCard = generateHeuristicCard(options, brief);
  } else if (backend === 'custom' && options.provider) {
    const prompt = `Generate an Orient card strictly conforming to JSON for directory: ${options.path}\nBrief:\n${JSON.stringify(brief, null, 2)}`;
    const output = await options.provider(prompt);
    const parsed = JSON.parse(output);

    // Merge authored data with required derived structure
    const authoredRole = RoleEnum.safeParse(parsed.role).success ? (parsed.role as Role) : 'services';
    rawCard = {
      id: `card:${options.level}:${options.path}`,
      level: options.level,
      path: options.path,
      version: 1,
      state: 'Fresh',
      derived: options.derived,
      authored: {
        purpose: parsed.purpose || `${options.path} subsystem.`,
        role: authoredRole,
        why: parsed.why || `Provides functionality for ${options.path}.`,
        oneThing: parsed.oneThing || 'Ensure strict typing and test coverage.',
        conventions: Array.isArray(parsed.conventions) ? parsed.conventions : [],
        doNot: Array.isArray(parsed.doNot) ? parsed.doNot : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : []
      },
      meta: {
        source: 'generated',
        confidence: 'medium',
        evidence: [],
        anchor: {
          commit: options.commit
        },
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  } else if (backend === 'ollama') {
    const url = options.ollamaUrl || 'http://127.0.0.1:11434/api/generate';
    const model = options.model || 'qwen2.5-coder';
    const prompt = `Generate a JSON object with fields purpose (<=140 chars), role, why (<=200 chars), oneThing (<=12 words), conventions (string array) for this brief:\n${JSON.stringify(brief)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, format: 'json' })
    });

    if (!res.ok) {
      throw new Error(`Ollama generation failed with status ${res.status}`);
    }

    const data = (await res.json()) as { response?: string };
    const parsed = JSON.parse(data.response || '{}');
    const authoredRole = RoleEnum.safeParse(parsed.role).success ? (parsed.role as Role) : 'services';

    rawCard = {
      id: `card:${options.level}:${options.path}`,
      level: options.level,
      path: options.path,
      version: 1,
      state: 'Fresh',
      derived: options.derived,
      authored: {
        purpose: parsed.purpose || `${options.path} subsystem.`,
        role: authoredRole,
        why: parsed.why || `Provides functionality for ${options.path}.`,
        oneThing: parsed.oneThing || 'Ensure strict typing and test coverage.',
        conventions: Array.isArray(parsed.conventions) ? parsed.conventions : [],
        doNot: Array.isArray(parsed.doNot) ? parsed.doNot : [],
        decisions: []
      },
      meta: {
        source: 'generated',
        confidence: 'medium',
        evidence: [],
        anchor: { commit: options.commit },
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  } else {
    rawCard = generateHeuristicCard(options, brief);
  }

  // Apply Critic Pass to strip hallucinations and enforce length bounds
  const { card: validatedCard } = criticPass(rawCard, brief);

  // Validate complete schema
  const verifiedCard = CardSchema.parse(validatedCard);

  GENERATOR_CACHE.set(cacheKey, verifiedCard);
  return verifiedCard;
}
