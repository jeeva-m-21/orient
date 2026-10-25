import { createHash } from 'node:crypto';
import type { RouteDef } from '@orient/schema';

/**
 * Computes standard Git-compatible blob SHA-1 hash (blob <len>\0<content>).
 */
export function computeBlobHash(content: string | Buffer): string {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  const header = Buffer.from(`blob ${buf.length}\0`, 'utf8');

  return createHash('sha1')
    .update(header)
    .update(buf)
    .digest('hex');
}

const JS_BLOCK_COMMENT_REGEX = /\/\*[\s\S]*?\*\//g;
const JS_LINE_COMMENT_REGEX = /\/\/.*$/gm;
const PYTHON_COMMENT_REGEX = /#.*$/gm;

/**
 * Normalizes source code by stripping comments and collapsing whitespace/formatting.
 * Produces a stable hash that is invariant to reformatting and comment modifications.
 */
export function computeNormalizedHash(content: string): string {
  if (!content) return computeBlobHash('');

  const stripped = content
    .replace(JS_BLOCK_COMMENT_REGEX, '')
    .replace(JS_LINE_COMMENT_REGEX, '')
    .replace(PYTHON_COMMENT_REGEX, '')
    // Collapse all whitespace sequences into single spaces
    .replace(/\s+/g, ' ')
    // Normalize spaces around structural tokens
    .replace(/\s*([{}();,:=[\]+*\/<>|&!?-])\s*/g, '$1')
    .trim();

  return createHash('sha1').update(stripped, 'utf8').digest('hex');
}

export interface InterfaceSurfaceInput {
  exports: string[];
  routes: RouteDef[];
  imports: string[];
  envVars?: string[];
  ports?: number[];
}

/**
 * Computes public interface hash over sorted exports, routes, imports, and environment variables.
 * Invariant to internal implementation edits when the public signature remains unchanged.
 */
export function computeInterfaceHash(surface: InterfaceSurfaceInput): string {
  const sortedExports = [...surface.exports].sort();
  const sortedImports = [...surface.imports].sort();
  const sortedRoutes = [...surface.routes].sort((a, b) =>
    `${a.method}:${a.path}`.localeCompare(`${b.method}:${b.path}`)
  );
  const sortedEnvVars = [...(surface.envVars ?? [])].sort();
  const sortedPorts = [...(surface.ports ?? [])].sort((a, b) => a - b);

  const payload = JSON.stringify({
    exports: sortedExports,
    routes: sortedRoutes,
    imports: sortedImports,
    envVars: sortedEnvVars,
    ports: sortedPorts
  });

  return createHash('sha1').update(payload, 'utf8').digest('hex');
}

export interface StructureEntry {
  name: string;
  kind: 'file' | 'dir';
}

/**
 * Computes directory structure hash based on sorted child entries and their kinds.
 * Detects additions, deletions, and renames within a folder.
 */
export function computeStructureHash(entries: StructureEntry[]): string {
  const sorted = [...entries].sort((a, b) =>
    `${a.kind}:${a.name}`.localeCompare(`${b.kind}:${b.name}`)
  );

  const serialized = sorted.map((e) => `${e.kind}:${e.name}`).join('\n');
  return createHash('sha1').update(serialized, 'utf8').digest('hex');
}
