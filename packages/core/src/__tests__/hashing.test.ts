import { describe, it, expect } from 'vitest';
import {
  computeBlobHash,
  computeNormalizedHash,
  computeInterfaceHash,
  computeStructureHash,
  type InterfaceSurfaceInput,
  type StructureEntry
} from '../index.js';

describe('Multi-Tier Hashing Engine (SPRINT-1.2)', () => {
  describe('computeBlobHash', () => {
    it('produces standard git-compatible blob SHA-1 hash', () => {
      // Empty blob git hash: "blob 0\0" -> e69de29bb2d1d6434b8b29ae775ad8c2e48c5391
      const emptyHash = computeBlobHash('');
      expect(emptyHash).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');

      // "hello world\n" in git: blob 12\0hello world\n -> 3b18e512dba79e4c8300dd08aeb37f8e728b8dad
      const helloHash = computeBlobHash('hello world\n');
      expect(helloHash).toBe('3b18e512dba79e4c8300dd08aeb37f8e728b8dad');
    });

    it('changes when any byte or whitespace changes', () => {
      const h1 = computeBlobHash('const x = 1;');
      const h2 = computeBlobHash('const x = 1; ');
      expect(h1).not.toBe(h2);
    });
  });

  describe('computeNormalizedHash', () => {
    it('is invariant to comment additions and whitespace formatting', () => {
      const code1 = `
        // Initial comment
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const code2 = `
        /* Different comment style */
        export function add(a: number, b: number): number {
          // Inner calculation comment
          return a + b;
        }
      `;

      const codeFormatted = `export function add(a:number,b:number):number{return a+b;}`;

      const h1 = computeNormalizedHash(code1);
      const h2 = computeNormalizedHash(code2);
      const hFormatted = computeNormalizedHash(codeFormatted);

      expect(h1).toBe(h2);
      expect(h1).toBe(hFormatted);
    });

    it('changes when logic statements change', () => {
      const codeA = `export function add(a: number, b: number) { return a + b; }`;
      const codeB = `export function add(a: number, b: number) { return a - b; }`;

      const hA = computeNormalizedHash(codeA);
      const hB = computeNormalizedHash(codeB);

      expect(hA).not.toBe(hB);
    });

    it('preserves JS/TS private class fields and does not confuse them with Python comments', () => {
      const classA = `class Service { #secretKey = 1; }`;
      const classB = `class Service { #otherKey = 2; }`;

      const hA = computeNormalizedHash(classA);
      const hB = computeNormalizedHash(classB);

      expect(hA).not.toBe(hB);
    });
  });

  describe('computeInterfaceHash', () => {
    it('is invariant to internal function body edits when interface is identical', () => {
      const surface1: InterfaceSurfaceInput = {
        exports: ['verifyToken', 'signToken'],
        routes: [{ method: 'POST', path: '/api/login' }],
        imports: ['jsonwebtoken', 'bcrypt']
      };

      const surface2: InterfaceSurfaceInput = {
        exports: ['signToken', 'verifyToken'], // order shuffled
        routes: [{ method: 'POST', path: '/api/login' }],
        imports: ['bcrypt', 'jsonwebtoken'] // order shuffled
      };

      const h1 = computeInterfaceHash(surface1);
      const h2 = computeInterfaceHash(surface2);

      expect(h1).toBe(h2);
    });

    it('changes when public exports or routes are added or removed', () => {
      const baseSurface: InterfaceSurfaceInput = {
        exports: ['verifyToken'],
        routes: [{ method: 'POST', path: '/api/login' }],
        imports: ['jsonwebtoken']
      };

      const changedSurface: InterfaceSurfaceInput = {
        exports: ['verifyToken', 'refreshToken'], // added export
        routes: [{ method: 'POST', path: '/api/login' }],
        imports: ['jsonwebtoken']
      };

      const hBase = computeInterfaceHash(baseSurface);
      const hChanged = computeInterfaceHash(changedSurface);

      expect(hBase).not.toBe(hChanged);
    });
  });

  describe('computeStructureHash', () => {
    it('computes deterministic directory structure hash based on sorted children', () => {
      const entries1: StructureEntry[] = [
        { name: 'jwt.ts', kind: 'file' },
        { name: 'passwords.ts', kind: 'file' },
        { name: 'session', kind: 'dir' }
      ];

      const entries2: StructureEntry[] = [
        { name: 'session', kind: 'dir' },
        { name: 'passwords.ts', kind: 'file' },
        { name: 'jwt.ts', kind: 'file' }
      ];

      const h1 = computeStructureHash(entries1);
      const h2 = computeStructureHash(entries2);

      expect(h1).toBe(h2);
    });

    it('changes when files are added, removed, or renamed', () => {
      const base: StructureEntry[] = [
        { name: 'jwt.ts', kind: 'file' },
        { name: 'passwords.ts', kind: 'file' }
      ];

      const withNewFile: StructureEntry[] = [
        { name: 'jwt.ts', kind: 'file' },
        { name: 'oauth.ts', kind: 'file' },
        { name: 'passwords.ts', kind: 'file' }
      ];

      const hBase = computeStructureHash(base);
      const hNew = computeStructureHash(withNewFile);

      expect(hBase).not.toBe(hNew);
    });
  });
});
