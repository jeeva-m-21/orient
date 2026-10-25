import { describe, it, expect } from 'vitest';
import { SCHEMA_VERSION } from '../index.js';

describe('Schema Version', () => {
  it('exports valid semantic version string', () => {
    expect(SCHEMA_VERSION).toBe('0.1.0');
  });
});
