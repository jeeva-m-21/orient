import type { RouteDef } from '@orient/schema';

export interface ExtractedSymbol {
  name: string;
  kind: 'function' | 'class' | 'variable' | 'type' | 'interface';
  isDefault?: boolean;
}

export interface ExtractedImport {
  source: string;
  specifiers: string[];
  isDynamic?: boolean;
}

export interface ExtractedFileFacts {
  language: 'typescript' | 'javascript';
  imports: ExtractedImport[];
  exports: ExtractedSymbol[];
  routes: RouteDef[];
  envVars: string[];
  ports: number[];
  todoCount: number;
  loc: number;
}

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']);

export function extractTypeScriptFacts(content: string, filePath: string): ExtractedFileFacts {
  const isTypeScript = /\.(ts|tsx|mts|cts)$/i.test(filePath) || !/\.(js|jsx|mjs|cjs)$/i.test(filePath);
  const language: 'typescript' | 'javascript' = isTypeScript ? 'typescript' : 'javascript';

  const loc = content.length === 0 ? 0 : content.split(/\r?\n/).length;

  // 1. TODO/FIXME comment count
  const todoMatches = content.match(/(?:\/\/|\/\*)\s*(?:TODO|FIXME)\b/gi);
  const todoCount = todoMatches ? todoMatches.length : 0;

  // 2. Environment Variables
  const envVarsSet = new Set<string>();
  const dotEnvRegex = /process\.env\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let envMatch: RegExpExecArray | null;
  while ((envMatch = dotEnvRegex.exec(content)) !== null) {
    if (envMatch[1]) envVarsSet.add(envMatch[1]);
  }
  const bracketEnvRegex = /process\.env\[['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\]/g;
  while ((envMatch = bracketEnvRegex.exec(content)) !== null) {
    if (envMatch[1]) envVarsSet.add(envMatch[1]);
  }

  // 3. Ports
  const portsSet = new Set<number>();
  const varAssignments = new Map<string, number>();

  // Collect variable assignments like const port = 4477 or const API_PORT = 8080
  const varAssignRegex = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(\d{2,5})\b/g;
  let varMatch: RegExpExecArray | null;
  while ((varMatch = varAssignRegex.exec(content)) !== null) {
    const varName = varMatch[1];
    const val = parseInt(varMatch[2]!, 10);
    if (val >= 1 && val <= 65535) {
      varAssignments.set(varName!, val);
      if (/port/i.test(varName!)) {
        portsSet.add(val);
      }
    }
  }

  // Check .listen(port) or .listen(3000)
  const listenRegex = /\.listen\s*\(\s*([a-zA-Z0-9_$]+|\d{2,5})\b/g;
  let listenMatch: RegExpExecArray | null;
  while ((listenMatch = listenRegex.exec(content)) !== null) {
    const target = listenMatch[1]!;
    if (/^\d+$/.test(target)) {
      const p = parseInt(target, 10);
      if (p >= 1 && p <= 65535) portsSet.add(p);
    } else if (varAssignments.has(target)) {
      portsSet.add(varAssignments.get(target)!);
    }
  }

  // 4. Imports (ESM, CJS, Dynamic)
  const importsMap = new Map<string, ExtractedImport>();

  function registerImport(source: string, specifiers: string[], isDynamic = false) {
    const cleanSource = source.trim();
    if (!cleanSource) return;

    const existing = importsMap.get(cleanSource);
    if (existing) {
      for (const spec of specifiers) {
        if (!existing.specifiers.includes(spec)) {
          existing.specifiers.push(spec);
        }
      }
      if (isDynamic) existing.isDynamic = true;
    } else {
      importsMap.set(cleanSource, {
        source: cleanSource,
        specifiers: [...specifiers],
        isDynamic: isDynamic ? true : undefined
      });
    }
  }

  // ESM imports: import { a, b as c } from 'source'
  // or: import def from 'source'
  // or: import def, { a } from 'source'
  // or: import * as ns from 'source'
  const esmImportRegex = /import\s+(?:type\s+)?(?:([a-zA-Z0-9_$]+)\s*,?\s*)?(?:(\*\s+as\s+[a-zA-Z0-9_$]+)|(?:\{([^}]*)\}))?\s*(?:from\s*)?['"]([^'"]+)['"]/g;
  let impMatch: RegExpExecArray | null;
  while ((impMatch = esmImportRegex.exec(content)) !== null) {
    const defaultSpec = impMatch[1];
    const starSpec = impMatch[2];
    const namedSpecs = impMatch[3];
    const source = impMatch[4];

    if (!source) continue;

    const specs: string[] = [];
    if (defaultSpec && defaultSpec !== 'type') {
      specs.push(defaultSpec.trim());
    }
    if (starSpec) {
      const alias = starSpec.replace(/\*\s+as\s+/, '').trim();
      if (alias) specs.push(alias);
    }
    if (namedSpecs) {
      namedSpecs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => {
          // 'b as c' -> 'c' (or 'b')
          const parts = s.split(/\s+as\s+/);
          specs.push(parts[0]!.trim());
        });
    }

    registerImport(source, specs, false);
  }

  // CJS require: const ... = require('...')
  const cjsRequireRegex = /(?:(?:const|let|var)\s+([a-zA-Z0-9_$,\s{}]+)\s*=\s*)?require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let cjsMatch: RegExpExecArray | null;
  while ((cjsMatch = cjsRequireRegex.exec(content)) !== null) {
    const specBinding = cjsMatch[1];
    const source = cjsMatch[2];
    if (!source) continue;

    const specs: string[] = [];
    if (specBinding) {
      const trimmed = specBinding.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        trimmed
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((s) => specs.push(s.split(':')[0]!.trim()));
      } else if (!trimmed.startsWith('{')) {
        specs.push(trimmed);
      }
    }
    registerImport(source, specs, false);
  }

  // Dynamic import: import('...')
  const dynamicImportRegex = /(?:\bawait\s+)?import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let dynMatch: RegExpExecArray | null;
  while ((dynMatch = dynamicImportRegex.exec(content)) !== null) {
    const source = dynMatch[1];
    if (source) {
      registerImport(source, [], true);
    }
  }

  // 5. Exports
  const exportsList: ExtractedSymbol[] = [];

  // Re-exports (e.g. export * from './foo.js' or export { a, b as c } from './bar.js')
  // These count as both dependencies (imports) and exported symbols
  const reExportRegex = /export\s+(?:type\s+)?(?:\*\s*(?:as\s+([a-zA-Z0-9_$]+))?|\{([^}]*)\})\s+from\s+['"]([^'"]+)['"]/g;
  let reExpMatch: RegExpExecArray | null;
  while ((reExpMatch = reExportRegex.exec(content)) !== null) {
    const starAlias = reExpMatch[1];
    const namedSpecs = reExpMatch[2];
    const source = reExpMatch[3];
    if (!source) continue;

    const specs: string[] = [];
    if (starAlias) {
      specs.push(starAlias.trim());
      exportsList.push({ name: starAlias.trim(), kind: 'variable' });
    }
    if (namedSpecs) {
      namedSpecs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => {
          const parts = s.split(/\s+as\s+/);
          const exportName = (parts[1] || parts[0])!.trim();
          specs.push(exportName);
          exportsList.push({ name: exportName, kind: 'variable' });
        });
    }
    registerImport(source, specs, false);
  }

  // Functions
  const funcExportRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/g;
  let expMatch: RegExpExecArray | null;
  while ((expMatch = funcExportRegex.exec(content)) !== null) {
    exportsList.push({ name: expMatch[1]!, kind: 'function' });
  }

  // Classes
  const classExportRegex = /export\s+class\s+([a-zA-Z0-9_$]+)/g;
  while ((expMatch = classExportRegex.exec(content)) !== null) {
    exportsList.push({ name: expMatch[1]!, kind: 'class' });
  }

  // Variables (const / let / var)
  const varExportRegex = /export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)/g;
  while ((expMatch = varExportRegex.exec(content)) !== null) {
    exportsList.push({ name: expMatch[1]!, kind: 'variable' });
  }

  // Types
  const typeExportRegex = /export\s+type\s+([a-zA-Z0-9_$]+)/g;
  while ((expMatch = typeExportRegex.exec(content)) !== null) {
    exportsList.push({ name: expMatch[1]!, kind: 'type' });
  }

  // Interfaces
  const ifaceExportRegex = /export\s+interface\s+([a-zA-Z0-9_$]+)/g;
  while ((expMatch = ifaceExportRegex.exec(content)) !== null) {
    exportsList.push({ name: expMatch[1]!, kind: 'interface' });
  }

  // Default export
  const defaultExportRegex = /export\s+default\s+(?:(async\s+)?function(?:\s+([a-zA-Z0-9_$]+))?|class(?:\s+([a-zA-Z0-9_$]+))?|([a-zA-Z0-9_$]+))/g;
  while ((expMatch = defaultExportRegex.exec(content)) !== null) {
    let kind: ExtractedSymbol['kind'] = 'variable';
    if (expMatch[0]?.includes('function')) {
      kind = 'function';
    } else if (expMatch[0]?.includes('class')) {
      kind = 'class';
    }
    exportsList.push({ name: 'default', kind, isDefault: true });
  }

  // 6. Routes
  const routesList: RouteDef[] = [];

  // Express / Fastify / generic router routes
  const routerRouteRegex = /\b(?:app|router|fastify|server)\.(get|post|put|delete|patch|options|head)\s*\(\s*(['"`])([^'"`]+)\2/gi;
  let routeMatch: RegExpExecArray | null;
  while ((routeMatch = routerRouteRegex.exec(content)) !== null) {
    const method = routeMatch[1]!.toUpperCase();
    const routePath = routeMatch[3]!;
    routesList.push({
      method,
      path: routePath,
      handlerRef: filePath
    });
  }

  // Next.js App Router HTTP verb exports (e.g. app/api/auth/route.ts)
  const isNextRouteFile = /(?:^|\/)(?:app\/)?(.+)\/route\.[jt]sx?$/i.test(filePath);
  if (isNextRouteFile) {
    const routePathMatch = filePath.match(/(?:^|\/)(?:app\/)?(.+)\/route\.[jt]sx?$/i);
    let derivedPath = routePathMatch?.[1] || '';
    // Strip route groups like (marketing)
    derivedPath = derivedPath.replace(/\/\([^)]+\)/g, '').replace(/^\([^)]+\)\/?/, '');
    const cleanPath = derivedPath.startsWith('/') ? derivedPath : `/${derivedPath}`;

    for (const exp of exportsList) {
      if (HTTP_METHODS.has(exp.name.toUpperCase()) && exp.kind === 'function') {
        routesList.push({
          method: exp.name.toUpperCase(),
          path: cleanPath || '/',
          handlerRef: filePath
        });
      }
    }
  }

  return {
    language,
    imports: Array.from(importsMap.values()),
    exports: exportsList,
    routes: routesList,
    envVars: Array.from(envVarsSet),
    ports: Array.from(portsSet),
    todoCount,
    loc
  };
}
