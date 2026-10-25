import path from 'node:path';
import type { KeyFile } from '@orient/schema';

export interface DependencyGraph {
  nodes: Set<string>;
  edges: Array<{ from: string; to: string }>;
  inDegree: Map<string, number>;
  outDegree: Map<string, number>;
  dependentsOf: Map<string, Set<string>>;
  dependenciesOf: Map<string, Set<string>>;
}

export function resolveImportPath(
  sourcePath: string,
  importSpecifier: string,
  knownFiles: string[]
): string | null {
  const knownSet = new Set(knownFiles);
  const normalizedSource = sourcePath.replace(/\\/g, '/');
  const baseDir = path.posix.dirname(normalizedSource);

  // 1. Python relative imports (e.g. .routers.items or ..models)
  if (importSpecifier.startsWith('.')) {
    const pythonRelativeMatch = /^(\.+)(.*)$/.exec(importSpecifier);
    if (pythonRelativeMatch && pythonRelativeMatch[2]?.includes('.')) {
      const dotCount = pythonRelativeMatch[1]!.length;
      const moduleParts = pythonRelativeMatch[2]!.split('.').filter(Boolean);

      let currentDir = baseDir;
      for (let i = 1; i < dotCount; i++) {
        currentDir = path.posix.dirname(currentDir);
      }

      const targetPath = path.posix.join(currentDir, ...moduleParts);
      const candidates = [`${targetPath}.py`, path.posix.join(targetPath, '__init__.py')];
      for (const cand of candidates) {
        if (knownSet.has(cand)) return cand;
      }
    }
  }

  // 2. Standard relative paths (./ or ../)
  if (importSpecifier.startsWith('./') || importSpecifier.startsWith('../')) {
    const rawTarget = path.posix.normalize(path.posix.join(baseDir, importSpecifier));

    // Direct match
    if (knownSet.has(rawTarget)) return rawTarget;

    // TypeScript mapping: .js/.jsx/.mjs/.cjs -> .ts/.tsx/.mts/.cts
    const tsReplacements = rawTarget
      .replace(/\.js$/, '.ts')
      .replace(/\.jsx$/, '.tsx')
      .replace(/\.mjs$/, '.mts')
      .replace(/\.cjs$/, '.cts');
    if (knownSet.has(tsReplacements)) return tsReplacements;

    // Extensionless candidates
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py'];
    for (const ext of extensions) {
      const withExt = `${rawTarget}${ext}`;
      if (knownSet.has(withExt)) return withExt;
    }

    // Directory index candidates
    const indexExtensions = [
      'index.ts',
      'index.tsx',
      'index.js',
      'index.jsx',
      '__init__.py'
    ];
    for (const idx of indexExtensions) {
      const withIndex = path.posix.join(rawTarget, idx);
      if (knownSet.has(withIndex)) return withIndex;
    }
  }

  // 3. Python relative import with simple dot: e.g. ..models
  if (importSpecifier.startsWith('.')) {
    const match = /^(\.+)([a-zA-Z0-9_]+)$/.exec(importSpecifier);
    if (match) {
      const dotCount = match[1]!.length;
      const name = match[2]!;

      let currentDir = baseDir;
      for (let i = 1; i < dotCount; i++) {
        currentDir = path.posix.dirname(currentDir);
      }
      const targetPy = path.posix.join(currentDir, `${name}.py`);
      if (knownSet.has(targetPy)) return targetPy;
    }
  }

  return null;
}

export function buildDependencyGraph(
  files: Array<{ path: string; imports: Array<{ source: string }> }>,
  allKnownFiles?: string[]
): DependencyGraph {
  const nodes = new Set<string>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const dependentsOf = new Map<string, Set<string>>();
  const dependenciesOf = new Map<string, Set<string>>();
  const edges: Array<{ from: string; to: string }> = [];

  const fileList = allKnownFiles || files.map((f) => f.path);

  // Initialize all known nodes
  for (const f of fileList) {
    const norm = f.replace(/\\/g, '/');
    nodes.add(norm);
    inDegree.set(norm, 0);
    outDegree.set(norm, 0);
    dependentsOf.set(norm, new Set());
    dependenciesOf.set(norm, new Set());
  }

  // Add edges from file imports
  for (const file of files) {
    const fromPath = file.path.replace(/\\/g, '/');
    if (!nodes.has(fromPath)) {
      nodes.add(fromPath);
      inDegree.set(fromPath, 0);
      outDegree.set(fromPath, 0);
      dependentsOf.set(fromPath, new Set());
      dependenciesOf.set(fromPath, new Set());
    }

    const seenTargets = new Set<string>();

    for (const imp of file.imports) {
      const resolved = resolveImportPath(fromPath, imp.source, fileList);
      if (resolved && resolved !== fromPath && !seenTargets.has(resolved)) {
        seenTargets.add(resolved);
        edges.push({ from: fromPath, to: resolved });

        outDegree.set(fromPath, (outDegree.get(fromPath) || 0) + 1);
        inDegree.set(resolved, (inDegree.get(resolved) || 0) + 1);

        dependenciesOf.get(fromPath)?.add(resolved);
        dependentsOf.get(resolved)?.add(fromPath);
      }
    }
  }

  return {
    nodes,
    edges,
    inDegree,
    outDegree,
    dependentsOf,
    dependenciesOf
  };
}

export function rankKeyFilesForFolder(
  folderPath: string,
  graph: DependencyGraph,
  fileFactsMap?: Map<string, { routes?: unknown[]; exports?: unknown[] }>,
  max = 3
): KeyFile[] {
  const normFolder = folderPath.replace(/\\/g, '/').replace(/^\.\/?/, '').replace(/\/$/, '');
  const candidates: string[] = [];

  for (const node of graph.nodes) {
    if (!normFolder || normFolder === '.') {
      candidates.push(node);
    } else if (node.startsWith(`${normFolder}/`) || node === normFolder) {
      candidates.push(node);
    }
  }

  const scored = candidates.map((filePath) => {
    const inDeg = graph.inDegree.get(filePath) || 0;
    const outDeg = graph.outDegree.get(filePath) || 0;
    const facts = fileFactsMap?.get(filePath);
    const routesCount = Array.isArray(facts?.routes) ? facts.routes.length : 0;
    const exportsCount = Array.isArray(facts?.exports) ? facts.exports.length : 0;
    const isEntryPoint = /(?:^|\/)(index|main|app|server)\.[a-zA-Z]+$/.test(filePath);

    const score = inDeg * 3 + outDeg * 1 + routesCount * 2 + exportsCount * 0.5 + (isEntryPoint ? 2 : 0);

    let reason: string;
    if (routesCount > 0) {
      reason = `API entry point with ${routesCount} route${routesCount > 1 ? 's' : ''}`;
    } else if (inDeg >= 2) {
      reason = `High centrality (imported by ${inDeg} files)`;
    } else if (inDeg === 1) {
      reason = `Imported by ${inDeg} file`;
    } else if (isEntryPoint) {
      reason = 'Primary module entry point';
    } else if (outDeg > 1) {
      reason = `Module orchestrator (imports ${outDeg} files)`;
    } else {
      reason = `Module component with ${exportsCount} exports`;
    }

    return {
      path: filePath,
      score,
      reason
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, max).map((item) => ({
    path: item.path,
    reason: item.reason
  }));
}
