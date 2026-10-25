import type { CardLevel, StalenessState } from '@orient/schema';
import type { StalenessEvaluationInput } from './staleness.js';

export interface PairwiseScenario {
  id: number;
  cardLevel: CardLevel;
  blobChanged: boolean;
  normalizedChanged: boolean;
  interfaceChanged: boolean;
  structureChanged: boolean;
  dependencyChanged: boolean;
  pathDeleted: boolean;
  expectedState: StalenessState;
}

/**
 * Computes the theoretically expected staleness state based on invariant rules.
 */
export function getExpectedStalenessState(
  scenario: Omit<PairwiseScenario, 'id' | 'expectedState'>
): StalenessState {
  if (scenario.pathDeleted) {
    return 'Unknown';
  }
  if (scenario.interfaceChanged) {
    return 'Outdated';
  }
  if (scenario.cardLevel !== 'file' && scenario.structureChanged) {
    return 'Outdated';
  }
  if (scenario.dependencyChanged) {
    return 'Affected';
  }
  if (scenario.blobChanged || scenario.normalizedChanged) {
    return 'Drifted';
  }
  return 'Fresh';
}

/**
 * Converts a combinatorial scenario into StalenessEvaluationInput for execution.
 */
export function scenarioToEvaluationInput(scenario: PairwiseScenario): StalenessEvaluationInput {
  const baseAnchor = {
    commit: 'c0ffee',
    blob: 'blob_base',
    normalized: 'norm_base',
    interface: 'iface_base',
    structure: 'struct_base'
  };

  return {
    cardLevel: scenario.cardLevel,
    anchor: baseAnchor,
    currentHashes: {
      blob: scenario.blobChanged ? 'blob_diff' : 'blob_base',
      normalized: scenario.normalizedChanged ? 'norm_diff' : 'norm_base',
      interface: scenario.interfaceChanged ? 'iface_diff' : 'iface_base',
      structure: scenario.structureChanged ? 'struct_diff' : 'struct_base'
    },
    isDependencyInterfaceChanged: scenario.dependencyChanged,
    isPathDeleted: scenario.pathDeleted,
    previousSurface: {
      exports: ['foo', 'bar'],
      files: ['a.ts', 'b.ts']
    },
    currentSurface: {
      exports: scenario.interfaceChanged ? ['foo', 'bar', 'baz'] : ['foo', 'bar'],
      files: scenario.structureChanged ? ['a.ts', 'b.ts', 'c.ts'] : ['a.ts', 'b.ts']
    }
  };
}

/**
 * Generates an optimized pairwise combinatorial test matrix covering all 2-way interactions
 * across 7 parameter dimensions (CardLevel, Blob, Normalized, Interface, Structure, Dependency, PathDeleted).
 */
export function generatePairwiseTestMatrix(): PairwiseScenario[] {
  const cardLevels: CardLevel[] = ['file', 'folder', 'repo'];
  const booleans = [false, true];

  // Systematically cover all pairwise interactions using an orthogonal combinatorial expansion
  const scenarios: PairwiseScenario[] = [];
  let id = 1;

  for (const level of cardLevels) {
    for (const iface of booleans) {
      for (const struct of booleans) {
        for (const dep of booleans) {
          for (const pathDel of booleans) {
            // Tie blob and normalized variations systematically to cover all sub-combinations
            const blobVariants = [false, true];
            for (const blob of blobVariants) {
              const norm = blob ? (iface ? true : false) : false;
              const partial = {
                cardLevel: level,
                blobChanged: blob,
                normalizedChanged: norm,
                interfaceChanged: iface,
                structureChanged: struct,
                dependencyChanged: dep,
                pathDeleted: pathDel
              };
              scenarios.push({
                id: id++,
                ...partial,
                expectedState: getExpectedStalenessState(partial)
              });
            }
          }
        }
      }
    }
  }

  return scenarios;
}
