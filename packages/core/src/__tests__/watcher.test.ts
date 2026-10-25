import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AdaptiveWatcher,
  type WatcherEvent
} from '../index.js';

describe('Adaptive Watcher & Watcher Storm Suppression (SPRINT-1.5)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces normal file change events within 200ms window', () => {
    const events: WatcherEvent[] = [];
    const watcher = new AdaptiveWatcher({
      debounceMs: 200,
      stormThreshold: 50,
      onEvent: (event) => events.push(event)
    });

    // Simulate 3 file edits within 100ms
    watcher.simulateFileChange('src/auth/jwt.ts');
    watcher.simulateFileChange('src/auth/passwords.ts');
    watcher.simulateFileChange('src/routes/api.ts');

    expect(events).toHaveLength(0); // Debouncing

    // Advance timers by 200ms
    vi.advanceTimersByTime(200);

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('batch');
    if (events[0]?.type === 'batch') {
      expect(events[0].files).toHaveLength(3);
      expect(events[0].files).toContain('src/auth/jwt.ts');
    }
  });

  it('triggers storm suppression when event rate exceeds 50 files in 200ms', () => {
    const events: WatcherEvent[] = [];
    const watcher = new AdaptiveWatcher({
      debounceMs: 200,
      stormThreshold: 50,
      onEvent: (event) => events.push(event)
    });

    // Simulate rapid burst of 75 file changes (e.g., git checkout / git pull)
    for (let i = 0; i < 75; i++) {
      watcher.simulateFileChange(`src/module_${i}/index.ts`);
    }

    // Advance debounce window
    vi.advanceTimersByTime(200);

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('storm');
    if (events[0]?.type === 'storm') {
      expect(events[0].count).toBe(75);
      expect(events[0].requiresSnapshotDiff).toBe(true);
    }
  });

  it('handles massive 5,000-file bursts without event loop saturation', () => {
    const events: WatcherEvent[] = [];
    const watcher = new AdaptiveWatcher({
      debounceMs: 200,
      stormThreshold: 50,
      onEvent: (event) => events.push(event)
    });

    const start = performance.now();
    for (let i = 0; i < 5000; i++) {
      watcher.simulateFileChange(`packages/large_module/file_${i}.ts`);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100); // Enqueued in under 100ms
    vi.advanceTimersByTime(200);

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('storm');
    if (events[0]?.type === 'storm') {
      expect(events[0].count).toBe(5000);
      expect(events[0].requiresSnapshotDiff).toBe(true);
    }
  });

  it('filters out blacklisted sensitive paths and noise directories from watch queue', () => {
    const events: WatcherEvent[] = [];
    const watcher = new AdaptiveWatcher({
      debounceMs: 200,
      stormThreshold: 50,
      onEvent: (event) => events.push(event)
    });

    // Attempt to queue blacklisted and noise paths
    watcher.simulateFileChange('.env');
    watcher.simulateFileChange('.env.local');
    watcher.simulateFileChange('node_modules/lodash/index.js');
    watcher.simulateFileChange('dist/index.js');
    watcher.simulateFileChange('src/app.ts'); // valid file

    vi.advanceTimersByTime(200);

    expect(events).toHaveLength(1);
    if (events[0]?.type === 'batch') {
      expect(events[0].files).toEqual(['src/app.ts']);
    }
  });

  it('resets storm suppression state back to normal batching once calm resumes', () => {
    const events: WatcherEvent[] = [];
    const watcher = new AdaptiveWatcher({
      debounceMs: 200,
      stormThreshold: 50,
      onEvent: (event) => events.push(event)
    });

    // 1. Storm phase
    for (let i = 0; i < 60; i++) {
      watcher.simulateFileChange(`src/module_${i}.ts`);
    }
    vi.advanceTimersByTime(200);
    expect(events[0]?.type).toBe('storm');

    // 2. Calm phase: single normal edit
    watcher.simulateFileChange('src/single.ts');
    vi.advanceTimersByTime(200);

    expect(events).toHaveLength(2);
    expect(events[1]?.type).toBe('batch');
    if (events[1]?.type === 'batch') {
      expect(events[1].files).toEqual(['src/single.ts']);
    }
  });
});
