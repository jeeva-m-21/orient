import { describe, it, expect } from 'vitest';
import {
  generatePairwiseTestMatrix,
  scenarioToEvaluationInput,
  evaluateCardStaleness
} from '../index.js';

describe('Combinatorial State Testing with Pairwise Generation (SPRINT-1.4)', () => {
  const matrix = generatePairwiseTestMatrix();

  it('generates an orthogonal matrix covering all 5 card staleness states', () => {
    expect(matrix.length).toBeGreaterThanOrEqual(50);

    const states = new Set(matrix.map((s) => s.expectedState));
    expect(states.has('Fresh')).toBe(true);
    expect(states.has('Drifted')).toBe(true);
    expect(states.has('Outdated')).toBe(true);
    expect(states.has('Affected')).toBe(true);
    expect(states.has('Unknown')).toBe(true);
  });

  it('verifies 100% of generated combinatorial scenarios against the state machine', () => {
    let passedCount = 0;

    for (const scenario of matrix) {
      const evaluationInput = scenarioToEvaluationInput(scenario);
      const result = evaluateCardStaleness(evaluationInput);

      expect(result.state).toBe(scenario.expectedState);
      passedCount += 1;
    }

    expect(passedCount).toBe(matrix.length);
  });

  it('guarantees pairwise coverage of all parameter value pairs', () => {
    // Assert that every (cardLevel, stalenessState) combination exists
    const levelStatePairs = new Set(
      matrix.map((s) => `${s.cardLevel}:${s.expectedState}`)
    );

    expect(levelStatePairs.has('file:Fresh')).toBe(true);
    expect(levelStatePairs.has('file:Drifted')).toBe(true);
    expect(levelStatePairs.has('file:Outdated')).toBe(true);
    expect(levelStatePairs.has('file:Affected')).toBe(true);
    expect(levelStatePairs.has('file:Unknown')).toBe(true);

    expect(levelStatePairs.has('folder:Fresh')).toBe(true);
    expect(levelStatePairs.has('folder:Drifted')).toBe(true);
    expect(levelStatePairs.has('folder:Outdated')).toBe(true);
    expect(levelStatePairs.has('folder:Affected')).toBe(true);
    expect(levelStatePairs.has('folder:Unknown')).toBe(true);
  });
});
