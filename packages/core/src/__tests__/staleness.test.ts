import { describe, it, expect } from 'vitest';
import {
  evaluateCardStaleness,
  type StalenessEvaluationInput
} from '../index.js';

describe('Card Staleness State Machine (SPRINT-1.3)', () => {
  const baseAnchor = {
    commit: 'c0ffee123',
    blob: 'blob_v1',
    normalized: 'norm_v1',
    interface: 'iface_v1',
    structure: 'struct_v1'
  };

  it('evaluates to Fresh when all hashes match anchor', () => {
    const input: StalenessEvaluationInput = {
      cardLevel: 'file',
      anchor: baseAnchor,
      currentHashes: {
        blob: 'blob_v1',
        normalized: 'norm_v1',
        interface: 'iface_v1'
      }
    };

    const result = evaluateCardStaleness(input);
    expect(result.state).toBe('Fresh');
    expect(result.reason).toContain('matches described snapshot');
    expect(result.delta).toBeUndefined();
  });

  it('evaluates to Drifted when blob or normalized changes but interface is identical', () => {
    const input: StalenessEvaluationInput = {
      cardLevel: 'file',
      anchor: baseAnchor,
      currentHashes: {
        blob: 'blob_v2_comment_added',
        normalized: 'norm_v2_internal_logic_tweaked',
        interface: 'iface_v1' // interface UNCHANGED
      }
    };

    const result = evaluateCardStaleness(input);
    expect(result.state).toBe('Drifted');
    expect(result.reason).toContain('interface intact');
  });

  it('evaluates to Outdated when interface hash changes and computes delta', () => {
    const input: StalenessEvaluationInput = {
      cardLevel: 'file',
      anchor: baseAnchor,
      currentHashes: {
        blob: 'blob_v3',
        normalized: 'norm_v3',
        interface: 'iface_v2_changed'
      },
      previousSurface: {
        exports: ['login', 'logout', 'legacyAuth'],
        routes: ['POST /login']
      },
      currentSurface: {
        exports: ['login', 'logout', 'refreshToken'], // removed legacyAuth, added refreshToken
        routes: ['POST /login', 'POST /refresh'] // added POST /refresh
      }
    };

    const result = evaluateCardStaleness(input);
    expect(result.state).toBe('Outdated');
    expect(result.delta).toBeDefined();
    expect(result.delta?.addedExports).toEqual(['refreshToken']);
    expect(result.delta?.removedExports).toEqual(['legacyAuth']);
    expect(result.delta?.addedRoutes).toEqual(['POST /refresh']);
    expect(result.delta?.removedRoutes).toEqual([]);
  });

  it('evaluates to Outdated for folder when structure hash changes and computes file delta', () => {
    const input: StalenessEvaluationInput = {
      cardLevel: 'folder',
      anchor: baseAnchor,
      currentHashes: {
        structure: 'struct_v2_changed',
        interface: 'iface_v1'
      },
      previousSurface: {
        files: ['jwt.ts', 'passwords.ts']
      },
      currentSurface: {
        files: ['jwt.ts', 'passwords.ts', 'oauth.ts'] // added oauth.ts
      }
    };

    const result = evaluateCardStaleness(input);
    expect(result.state).toBe('Outdated');
    expect(result.delta?.addedFiles).toEqual(['oauth.ts']);
    expect(result.delta?.removedFiles).toEqual([]);
  });

  it('evaluates to Affected when 1-hop upstream dependency interface changed', () => {
    const input: StalenessEvaluationInput = {
      cardLevel: 'file',
      anchor: baseAnchor,
      currentHashes: {
        blob: 'blob_v1',
        normalized: 'norm_v1',
        interface: 'iface_v1'
      },
      isDependencyInterfaceChanged: true
    };

    const result = evaluateCardStaleness(input);
    expect(result.state).toBe('Affected');
    expect(result.reason).toContain('Dependency interface changed');
  });

  it('returns Unknown if path has been deleted', () => {
    const input: StalenessEvaluationInput = {
      cardLevel: 'file',
      anchor: baseAnchor,
      currentHashes: {},
      isPathDeleted: true
    };

    const result = evaluateCardStaleness(input);
    expect(result.state).toBe('Unknown');
    expect(result.reason).toContain('deleted');
  });

  it('returns to Fresh when code is reverted back to the described hash', () => {
    // 1. First Drifted
    const driftedInput: StalenessEvaluationInput = {
      cardLevel: 'file',
      anchor: baseAnchor,
      currentHashes: { blob: 'blob_temp', normalized: 'norm_temp', interface: 'iface_v1' }
    };
    expect(evaluateCardStaleness(driftedInput).state).toBe('Drifted');

    // 2. Reverted back to baseAnchor
    const revertedInput: StalenessEvaluationInput = {
      cardLevel: 'file',
      anchor: baseAnchor,
      currentHashes: { blob: 'blob_v1', normalized: 'norm_v1', interface: 'iface_v1' }
    };
    expect(evaluateCardStaleness(revertedInput).state).toBe('Fresh');
  });
});
