import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { isBlacklistedPath, validateSafePath } from '@orient/schema';

const execFileAsync = promisify(execFile);

export interface ScannedFile {
  path: string;
  mode: string;
  blobHash: string;
  stage: number;
  isUntracked?: boolean;
}

export type NoiseCategory = 'dependencies' | 'build-output' | 'cache' | 'lockfiles';

export interface NoiseGroup {
  category: NoiseCategory;
  paths: string[];
  totalCount: number;
}

export interface TreeScanResult {
  repoRoot: string;
  commit: string;
  files: Map<string, ScannedFile>;
  noise: Map<string, NoiseGroup>;
  durationMs: number;
}

const NOISE_PATTERNS: { category: NoiseCategory; regex: RegExp }[] = [
  {
    category: 'dependencies',
    regex: /(^|\/)(node_modules|vendor\/bundle|venv|\.venv)(\/|$)/i
  },
  {
    category: 'build-output',
    regex: /(^|\/)(dist|build|\.next|target|out|\.turbo)(\/|$)/i
  },
  {
    category: 'cache',
    regex: /(^|\/)(__pycache__|\.cache|\.pytest_cache|\.nyc_output)(\/|$)/i
  },
  {
    category: 'lockfiles',
    regex: /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|Cargo\.lock|Gemfile\.lock|composer\.lock)$/i
  }
];

/**
 * Classifies whether a file path belongs to dependencies, build artifacts, caches, or lockfiles.
 * Returns null for active application source code.
 */
export function classifyNoisePath(filePath: string): NoiseCategory | null {
  if (!filePath) return null;
  const posixPath = filePath.split(path.sep).join('/');

  for (const { category, regex } of NOISE_PATTERNS) {
    if (regex.test(posixPath)) {
      return category;
    }
  }

  return null;
}

/**
 * Parses raw git ls-files -s output and filters out blacklisted sensitive files (Layer 3 defense).
 */
export function parseGitLsFilesOutput(output: string): Map<string, ScannedFile> {
  const files = new Map<string, ScannedFile>();
  if (!output || output.trim() === '') return files;

  const lines = output.trim().split('\n');
  const lineRegex = /^([0-7]+)\s+([0-9a-f]{40})\s+(\d+)\t(.+)$/;

  for (const line of lines) {
    const match = lineRegex.exec(line.trim());
    if (!match) continue;

    const [, mode, blobHash, stageStr, filePath] = match;
    if (!mode || !blobHash || !stageStr || !filePath) continue;

    const cleanPath = filePath.trim();

    // Defense-in-depth: Never ingest blacklisted files into index
    if (isBlacklistedPath(cleanPath)) {
      continue;
    }

    files.set(cleanPath, {
      path: cleanPath,
      mode,
      blobHash,
      stage: parseInt(stageStr, 10),
      isUntracked: false
    });
  }

  return files;
}

/**
 * Scans a git repository using git ls-files -s and untracked file enumeration.
 * Groups noise paths and returns indexed file metadata.
 */
export async function scanGitRepository(repoRoot: string): Promise<TreeScanResult> {
  const startTime = Date.now();
  const safeRoot = path.resolve(repoRoot);

  let commit = '0000000000000000000000000000000000000000';
  try {
    const { stdout: commitOutput } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: safeRoot
    });
    commit = commitOutput.trim();
  } catch {
    // Uncommitted empty repository fallback
  }

  // Read git index blobs in a single native process execution
  const { stdout: lsFilesOutput } = await execFileAsync('git', ['ls-files', '-s'], {
    cwd: safeRoot,
    maxBuffer: 50 * 1024 * 1024
  });

  const files = parseGitLsFilesOutput(lsFilesOutput);

  // Read untracked non-ignored files
  try {
    const { stdout: untrackedOutput } = await execFileAsync(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd: safeRoot, maxBuffer: 10 * 1024 * 1024 }
    );

    if (untrackedOutput.trim()) {
      const untrackedLines = untrackedOutput.trim().split('\n');
      for (const rawLine of untrackedLines) {
        const filePath = rawLine.trim();
        if (!filePath || isBlacklistedPath(filePath)) continue;

        const safeCheck = validateSafePath(safeRoot, filePath);
        if (!safeCheck.safe) continue;

        // Hash untracked file via git hash-object
        try {
          const { stdout: hashOutput } = await execFileAsync(
            'git',
            ['hash-object', safeCheck.normalizedPath],
            { cwd: safeRoot }
          );
          const blobHash = hashOutput.trim();
          files.set(safeCheck.normalizedPath, {
            path: safeCheck.normalizedPath,
            mode: '100644',
            blobHash,
            stage: 0,
            isUntracked: true
          });
        } catch {
          // File may have been removed concurrently
        }
      }
    }
  } catch {
    // Untracked query fallback
  }

  // Categorize noise groups
  const noise = new Map<string, NoiseGroup>();
  for (const [filePath] of files) {
    const category = classifyNoisePath(filePath);
    if (category) {
      const existing = noise.get(category) ?? { category, paths: [], totalCount: 0 };
      existing.paths.push(filePath);
      existing.totalCount += 1;
      noise.set(category, existing);
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    repoRoot: safeRoot,
    commit,
    files,
    noise,
    durationMs
  };
}
