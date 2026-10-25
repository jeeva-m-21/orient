import { describe, it, expect } from 'vitest';
import {
  scanGitRepository,
  parseGitLsFilesOutput,
  classifyNoisePath,
  type ScannedFile
} from '../index.js';
import path from 'node:path';

describe('Git Tree Scanner & Noise Classifier (SPRINT-1.1)', () => {
  describe('parseGitLsFilesOutput', () => {
    it('parses standard git ls-files -s output lines', () => {
      const sampleOutput = [
        '100644 e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 0\tsrc/index.ts',
        '100644 4b825dc642cb6eb9a060e54bf8d69288fbee4904 0\tsrc/auth/jwt.ts',
        '100644 1122334455667788990011223344556677889900 0\tpackage.json'
      ].join('\n');

      const files = parseGitLsFilesOutput(sampleOutput);
      expect(files.size).toBe(3);

      const authFile = files.get('src/auth/jwt.ts') as ScannedFile;
      expect(authFile).toBeDefined();
      expect(authFile.mode).toBe('100644');
      expect(authFile.blobHash).toBe('4b825dc642cb6eb9a060e54bf8d69288fbee4904');
      expect(authFile.stage).toBe(0);
    });

    it('filters out blacklisted paths during parsing (Layer 3 defense)', () => {
      const sampleOutput = [
        '100644 1111111111111111111111111111111111111111 0\tsrc/index.ts',
        '100644 2222222222222222222222222222222222222222 0\t.env',
        '100644 3333333333333333333333333333333333333333 0\t.env.development.local',
        '100644 4444444444444444444444444444444444444444 0\tsecrets/server.key'
      ].join('\n');

      const files = parseGitLsFilesOutput(sampleOutput);
      expect(files.size).toBe(1);
      expect(files.has('src/index.ts')).toBe(true);
      expect(files.has('.env')).toBe(false);
      expect(files.has('.env.development.local')).toBe(false);
      expect(files.has('secrets/server.key')).toBe(false);
    });
  });

  describe('classifyNoisePath', () => {
    it('identifies dependencies noise', () => {
      expect(classifyNoisePath('node_modules/lodash/index.js')).toBe('dependencies');
      expect(classifyNoisePath('vendor/bundle/ruby/test.rb')).toBe('dependencies');
    });

    it('identifies build-output noise', () => {
      expect(classifyNoisePath('dist/index.js')).toBe('build-output');
      expect(classifyNoisePath('build/bundle.js')).toBe('build-output');
      expect(classifyNoisePath('.next/server/pages.js')).toBe('build-output');
      expect(classifyNoisePath('target/classes/App.class')).toBe('build-output');
    });

    it('identifies cache noise', () => {
      expect(classifyNoisePath('__pycache__/app.cpython-310.pyc')).toBe('cache');
      expect(classifyNoisePath('.cache/turbo.json')).toBe('cache');
    });

    it('identifies lockfiles noise', () => {
      expect(classifyNoisePath('package-lock.json')).toBe('lockfiles');
      expect(classifyNoisePath('pnpm-lock.yaml')).toBe('lockfiles');
      expect(classifyNoisePath('yarn.lock')).toBe('lockfiles');
    });

    it('returns null for normal application source code', () => {
      expect(classifyNoisePath('src/auth/jwt.ts')).toBeNull();
      expect(classifyNoisePath('package.json')).toBeNull();
      expect(classifyNoisePath('app/page.tsx')).toBeNull();
    });
  });

  describe('scanGitRepository', () => {
    it('scans the current repository in under 1 second', async () => {
      const repoRoot = path.resolve(process.cwd());
      const scan = await scanGitRepository(repoRoot);

      expect(scan.repoRoot).toBe(repoRoot);
      expect(scan.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(scan.files.size).toBeGreaterThan(5);
      expect(scan.durationMs).toBeLessThan(1000);
      expect(scan.files.has('package.json')).toBe(true);
      expect(scan.files.has('ARCHITECTURE.md')).toBe(true);
    });
  });
});
