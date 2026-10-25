import path from 'node:path';

const DANGEROUS_HTML_REGEX = /<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi;
const ANY_TAG_REGEX = /<[^>]+>/g;
const PROMPT_INJECTION_REGEX =
  /\b(ignore\s+(all\s+)?(previous\s+|prior\s+|above\s+)?(instructions|rules|directives|constraints)|disregard\s+(all\s+)?(previous\s+|prior\s+|above\s+)?(instructions|rules)|system\s*:|assistant\s*:|human\s*:|user\s*:|\[\/?INST\]|<\|im_(start|end)\|>|you\s+are\s+now\b|act\s+as\s+a\b)/gi;

/**
 * Strips HTML, dangerous script tags, and prompt injection directives from card text.
 * Enforces maximum character length limit.
 */
export function sanitizeCardText(text: string, maxLength: number): string {
  if (!text) return '';

  let sanitized = text
    .replace(DANGEROUS_HTML_REGEX, '')
    .replace(ANY_TAG_REGEX, '')
    .replace(PROMPT_INJECTION_REGEX, '')
    .replace(/```+/g, "'''")
    .replace(/\s+/g, ' ')
    .trim();

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).trim();
  }

  return sanitized;
}

/**
 * Validates that text does not exceed the allowed maximum word count.
 */
export function validateWordCount(text: string, maxWords: number): boolean {
  if (!text || text.trim() === '') return true;
  const words = text.trim().split(/\s+/);
  return words.length <= maxWords;
}

export interface SafePathResult {
  safe: boolean;
  normalizedPath: string;
  error?: string;
}

/**
 * Validates that targetPath does not escape repoRoot (Layer 1 path traversal defense).
 * Rejects null bytes, directory escaping (../), and absolute cross-drive paths.
 */
export function validateSafePath(repoRoot: string, targetPath: string): SafePathResult {
  if (!targetPath) {
    return { safe: false, normalizedPath: '', error: 'Target path cannot be empty' };
  }

  if (targetPath.includes('\0')) {
    return { safe: false, normalizedPath: '', error: 'Path contains forbidden null byte' };
  }

  // Normalize backslashes to forward slashes for cross-platform traversal defense
  const normalizedInput = targetPath.replace(/\\/g, '/');

  const rootResolved = path.resolve(repoRoot);
  const targetResolved = path.resolve(rootResolved, normalizedInput);

  const relative = path.relative(rootResolved, targetResolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return {
      safe: false,
      normalizedPath: '',
      error: `Path escapes repository boundary: ${targetPath}`
    };
  }

  // Normalize to POSIX style relative path
  const posixPath = relative.split(path.sep).join('/');
  return { safe: true, normalizedPath: posixPath };
}

const BLACKLIST_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /^id_rsa$/i,
  /^id_ed25519$/i,
  /^id_ecdsa$/i,
  /\.pfx$/i,
  /\.pkcs12$/i,
  /^credentials\.json$/i,
  /(^|\/)\.git\/config$/i,
  /\.secret$/i
];

const WHITELIST_EXCEPTIONS = [
  /\.env\.example$/i,
  /\.env\.sample$/i,
  /\.env\.template$/i
];

/**
 * Checks whether a relative or absolute file path matches the sensitive secrets blacklist (Layer 3 defense).
 */
export function isBlacklistedPath(filePath: string): boolean {
  if (!filePath) return false;
  const posixPath = filePath.split(path.sep).join('/');
  const basename = path.basename(posixPath);

  for (const exception of WHITELIST_EXCEPTIONS) {
    if (exception.test(basename)) {
      return false;
    }
  }

  for (const pattern of BLACKLIST_PATTERNS) {
    if (pattern.test(posixPath) || pattern.test(basename)) {
      return true;
    }
  }

  return false;
}
