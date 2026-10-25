import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  parseGitLsFilesOutput,
  computeStructureHash,
  computeFolderInterfaceHash
} from '../index.js';

describe('Scalability & Performance Benchmark Verification (SPRINT-8.3)', () => {
  it('processes a 10,000-file repository within strict time and memory budgets', () => {
    // 1. Generate synthetic 10,000-file git ls-files output across 500 directories
    const fileCount = 10000;
    const lines: string[] = [];
    const hash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

    for (let i = 0; i < fileCount; i++) {
      const dirIndex = i % 500;
      const path = `packages/pkg-${dirIndex}/src/file-${i}.ts`;
      lines.push(`100644 ${hash} 0\t${path}`);
    }
    const rawOutput = lines.join('\n');

    // Measure memory before
    if (global.gc) global.gc();
    const memBefore = process.memoryUsage().heapUsed;
    const startParse = performance.now();

    // 2. Parse 10,000 files
    const parsedFiles = parseGitLsFilesOutput(rawOutput);
    const parseTimeMs = performance.now() - startParse;

    // Verify 10,000 files parsed
    expect(parsedFiles.size).toBe(fileCount);

    // Gate: parse time budget < 1,000ms (1.0s)
    expect(parseTimeMs).toBeLessThan(1000);

    // 3. Compute structure hash for all 500 folders
    const startStructure = performance.now();
    const folderEntries = new Map<string, Array<{ name: string; kind: 'file' | 'dir' }>>();

    for (const [filePath] of parsedFiles) {
      const parts = filePath.split('/');
      parts.pop(); // filename
      const folderPath = parts.join('/');
      if (!folderEntries.has(folderPath)) {
        folderEntries.set(folderPath, []);
      }
      folderEntries.get(folderPath)!.push({ name: filePath, kind: 'file' });
    }

    const structureHashes = new Map<string, string>();
    for (const [folder, entries] of folderEntries) {
      structureHashes.set(folder, computeStructureHash(entries));
    }

    const structureTimeMs = performance.now() - startStructure;

    expect(folderEntries.size).toBe(500);
    expect(structureHashes.size).toBe(500);

    // Gate: structure calculation < 1,000ms
    expect(structureTimeMs).toBeLessThan(1000);

    // 4. Memory check: heap delta must be under 120MB
    const memAfter = process.memoryUsage().heapUsed;
    const heapUsedMB = (memAfter - memBefore) / (1024 * 1024);
    expect(heapUsedMB).toBeLessThan(120);
  });

  it('stress tests a 50,000-file enterprise monorepo within scalability bounds', () => {
    const fileCount = 50000;
    const lines: string[] = [];
    const hash = '3b825dc642cb6eb9a060e54bf8d69288fbee4904';

    for (let i = 0; i < fileCount; i++) {
      const dirIndex = i % 2000;
      const path = `services/svc-${dirIndex}/handlers/item-${i}.ts`;
      lines.push(`100644 ${hash} 0\t${path}`);
    }
    const rawOutput = lines.join('\n');

    const startParse = performance.now();
    const parsedFiles = parseGitLsFilesOutput(rawOutput);
    const parseTimeMs = performance.now() - startParse;

    expect(parsedFiles.size).toBe(fileCount);

    // Gate: full 50,000 file parse < 3,000ms (3.0s)
    expect(parseTimeMs).toBeLessThan(3000);

    // Memory check for 50k files: must remain < 500MB
    const memUsageMB = process.memoryUsage().heapUsed / (1024 * 1024);
    expect(memUsageMB).toBeLessThan(500);
  });

  it('benchmarks folder interface hash aggregation across 1,000 child files', () => {
    const childFileHashes = new Map<string, string>();
    for (let i = 0; i < 1000; i++) {
      const childHash = crypto.createHash('sha256').update(`child-${i}`).digest('hex');
      childFileHashes.set(`src/components/Comp${i}.tsx`, childHash);
    }

    const start = performance.now();
    const folderInterfaceHash = computeFolderInterfaceHash(childFileHashes);
    const elapsed = performance.now() - start;

    expect(folderInterfaceHash).toBeDefined();
    expect(folderInterfaceHash.length).toBe(40);

    // Gate: interface aggregation across 1,000 files in < 50ms
    expect(elapsed).toBeLessThan(50);
  });
});
