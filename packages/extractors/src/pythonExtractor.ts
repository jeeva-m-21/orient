import type { RouteDef } from '@orient/schema';
import type { ExtractedImport, ExtractedSymbol } from './tsExtractor.js';

export interface ExtractedPythonFacts {
  language: 'python';
  imports: ExtractedImport[];
  exports: ExtractedSymbol[];
  routes: RouteDef[];
  envVars: string[];
  ports: number[];
  todoCount: number;
  loc: number;
}

export function extractPythonFacts(content: string, filePath: string): ExtractedPythonFacts {
  const loc = content.length === 0 ? 0 : content.split(/\r?\n/).length;

  // 1. TODO/FIXME count
  const todoMatches = content.match(/#\s*(?:TODO|FIXME)\b/gi);
  const todoCount = todoMatches ? todoMatches.length : 0;

  // 2. Environment Variables
  const envVarsSet = new Set<string>();

  const osEnvironBracket = /os\.environ\[['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\]/g;
  let envMatch: RegExpExecArray | null;
  while ((envMatch = osEnvironBracket.exec(content)) !== null) {
    if (envMatch[1]) envVarsSet.add(envMatch[1]);
  }

  const osEnvironGet = /os\.environ\.get\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g;
  while ((envMatch = osEnvironGet.exec(content)) !== null) {
    if (envMatch[1]) envVarsSet.add(envMatch[1]);
  }

  const osGetenv = /os\.getenv\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g;
  while ((envMatch = osGetenv.exec(content)) !== null) {
    if (envMatch[1]) envVarsSet.add(envMatch[1]);
  }

  // 3. Ports
  const portsSet = new Set<number>();
  const portRegex = /(?:port\s*=\s*|PORT\s*=\s*)(\d{2,5})\b/gi;
  let portMatch: RegExpExecArray | null;
  while ((portMatch = portRegex.exec(content)) !== null) {
    const p = parseInt(portMatch[1]!, 10);
    if (p >= 1 && p <= 65535) {
      portsSet.add(p);
    }
  }

  // 4. Imports
  const importsMap = new Map<string, ExtractedImport>();

  function registerImport(source: string, specifiers: string[]) {
    const cleanSource = source.trim();
    if (!cleanSource) return;

    const existing = importsMap.get(cleanSource);
    if (existing) {
      for (const spec of specifiers) {
        if (!existing.specifiers.includes(spec)) {
          existing.specifiers.push(spec);
        }
      }
    } else {
      importsMap.set(cleanSource, {
        source: cleanSource,
        specifiers: [...specifiers]
      });
    }
  }

  // from <module> import <items>
  const fromImportRegex = /^[ \t]*from\s+([.a-zA-Z0-9_]+)\s+import\s+([^\r\n#]+)/gm;
  let fromMatch: RegExpExecArray | null;
  while ((fromMatch = fromImportRegex.exec(content)) !== null) {
    const source = fromMatch[1]!.trim();
    const rawSpecs = fromMatch[2]!.replace(/[()]/g, '');
    const specs: string[] = [];
    rawSpecs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((item) => {
        // e.g. "router as items_router" or "ItemModel"
        const parts = item.split(/\s+as\s+/);
        specs.push((parts[1] || parts[0])!.trim());
      });
    registerImport(source, specs);
  }

  // import <module> [as <alias>] [, <module2> [as <alias2>]]
  const directImportRegex = /^[ \t]*import\s+([^\r\n#]+)/gm;
  let directMatch: RegExpExecArray | null;
  while ((directMatch = directImportRegex.exec(content)) !== null) {
    const rawModules = directMatch[1]!;
    rawModules
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((item) => {
        const parts = item.split(/\s+as\s+/);
        const source = parts[0]!.trim();
        const spec = parts[1]?.trim();
        registerImport(source, spec ? [spec] : []);
      });
  }

  // 5. Exports (top-level classes, functions, uppercase variables)
  const exportsList: ExtractedSymbol[] = [];

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    // Classes
    const classMatch = /^class\s+([a-zA-Z0-9_]+)/.exec(line);
    if (classMatch) {
      exportsList.push({ name: classMatch[1]!, kind: 'class' });
      continue;
    }

    // Functions (sync or async)
    const funcMatch = /^(?:async\s+)?def\s+([a-zA-Z0-9_]+)/.exec(line);
    if (funcMatch) {
      exportsList.push({ name: funcMatch[1]!, kind: 'function' });
      continue;
    }

    // Top-level uppercase constants
    const varMatch = /^([A-Z0-9_]{2,})\s*=/.exec(line);
    if (varMatch) {
      exportsList.push({ name: varMatch[1]!, kind: 'variable' });
      continue;
    }
  }

  // 6. Routes (FastAPI & Flask decorators)
  const routesList: RouteDef[] = [];

  // FastAPI route decorators: @app.get("/path"), @router.post("/path")
  const fastApiRouteRegex = /@(?:[a-zA-Z0-9_]+)\.(get|post|put|delete|patch|options|head)\s*\(\s*(?:f)?['"]([^'"]+)['"]/gi;
  let faMatch: RegExpExecArray | null;
  while ((faMatch = fastApiRouteRegex.exec(content)) !== null) {
    routesList.push({
      method: faMatch[1]!.toUpperCase(),
      path: faMatch[2]!,
      handlerRef: filePath
    });
  }

  // Flask route decorators: @app.route("/path", methods=["GET", "POST"])
  const flaskRouteRegex = /@(?:[a-zA-Z0-9_]+)\.route\s*\(\s*(?:f)?['"]([^'"]+)['"](?:\s*,\s*methods\s*=\s*\[([^\]]+)\])?/gi;
  let flMatch: RegExpExecArray | null;
  while ((flMatch = flaskRouteRegex.exec(content)) !== null) {
    const routePath = flMatch[1]!;
    const methodsStr = flMatch[2];
    if (methodsStr) {
      const methods = methodsStr
        .split(',')
        .map((m) => m.replace(/['"\s]/g, '').toUpperCase())
        .filter(Boolean);
      for (const m of methods) {
        routesList.push({
          method: m,
          path: routePath,
          handlerRef: filePath
        });
      }
    } else {
      routesList.push({
        method: 'GET',
        path: routePath,
        handlerRef: filePath
      });
    }
  }

  return {
    language: 'python',
    imports: Array.from(importsMap.values()),
    exports: exportsList,
    routes: routesList,
    envVars: Array.from(envVarsSet),
    ports: Array.from(portsSet),
    todoCount,
    loc
  };
}
