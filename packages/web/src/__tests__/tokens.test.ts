import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Design Token System & Semantic Color Isolation (SPRINT-6.1)', () => {
  const cssPath = path.resolve(__dirname, '../styles/tokens.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  it('defines dark mode as default and provides light mode override', () => {
    expect(cssContent).toContain(':root,');
    expect(cssContent).toContain(':root[data-theme="dark"]');
    expect(cssContent).toContain(':root[data-theme="light"]');
  });

  it('enforces semantic isolation between status states and agent colors', () => {
    // Status tokens
    const statusStates = ['fresh', 'drifted', 'outdated', 'affected', 'unknown', 'error'];
    for (const state of statusStates) {
      expect(cssContent).toContain(`--status-${state}-fg`);
      expect(cssContent).toContain(`--status-${state}-bg`);
    }

    // Agent tokens
    const agentColors = ['coral', 'green', 'violet', 'amber', 'cyan', 'magenta'];
    for (const color of agentColors) {
      expect(cssContent).toContain(`--agent-${color}`);
    }

    // Ensure status colors and agent colors are distinct tokens
    expect(cssContent).not.toMatch(/--status-\w+-fg:\s*var\(--agent-/);
  });

  it('includes motion tokens with cubic-bezier ease and reduced-motion fallback', () => {
    expect(cssContent).toContain('--dur-fast: 120ms');
    expect(cssContent).toContain('--dur: 180ms');
    expect(cssContent).toContain('--ease: cubic-bezier(0.2, 0, 0, 1)');
    expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
