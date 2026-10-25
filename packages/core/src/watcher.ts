import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { isBlacklistedPath } from '@orient/schema';
import { classifyNoisePath } from './scanner.js';

export type WatcherEvent =
  | { type: 'batch'; files: string[] }
  | { type: 'storm'; count: number; requiresSnapshotDiff: true };

export interface AdaptiveWatcherOptions {
  debounceMs?: number;
  stormThreshold?: number;
  onEvent: (event: WatcherEvent) => void;
}

/**
 * Adaptive filesystem watcher with Watcher Storm Suppression.
 * Buffers edits in a 200ms debounce window. If file changes exceed stormThreshold (default 50),
 * suppresses individual file parsing events and dispatches an atomic snapshot diff requirement.
 */
export class AdaptiveWatcher {
  private readonly debounceMs: number;
  private readonly stormThreshold: number;
  private readonly onEvent: (event: WatcherEvent) => void;

  private pendingFiles = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private fsWatcher: FSWatcher | null = null;

  constructor(options: AdaptiveWatcherOptions) {
    this.debounceMs = options.debounceMs ?? 200;
    this.stormThreshold = options.stormThreshold ?? 50;
    this.onEvent = options.onEvent;
  }

  /**
   * Starts watching a directory using chokidar with native fs event binding.
   */
  public watch(directory: string): void {
    if (this.fsWatcher) {
      this.fsWatcher.close();
    }

    this.fsWatcher = chokidar.watch(directory, {
      ignored: (filePath: string) => {
        return (
          isBlacklistedPath(filePath) ||
          filePath.includes('node_modules') ||
          filePath.includes('/.git/')
        );
      },
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    const handler = (filePath: string) => {
      const rel = path.relative(directory, filePath);
      this.queueFile(rel);
    };

    this.fsWatcher.on('add', handler);
    this.fsWatcher.on('change', handler);
    this.fsWatcher.on('unlink', handler);
  }

  /**
   * Queues a file change event with defense-in-depth secret filtering and noise suppression.
   */
  public queueFile(filePath: string): void {
    if (!filePath) return;
    const posixPath = filePath.split(path.sep).join('/');

    // Layer 3 defense: Never watch or queue blacklisted credentials
    if (isBlacklistedPath(posixPath)) {
      return;
    }

    // Suppress dependencies, build outputs, and caches from granular parsing queue
    const noise = classifyNoisePath(posixPath);
    if (noise === 'dependencies' || noise === 'build-output' || noise === 'cache') {
      return;
    }

    this.pendingFiles.add(posixPath);

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }

  /**
   * Helper method for testing and simulated burst injection.
   */
  public simulateFileChange(filePath: string): void {
    this.queueFile(filePath);
  }

  /**
   * Flushes the pending files queue, triggering either normal batching or storm suppression.
   */
  public flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const count = this.pendingFiles.size;
    if (count === 0) return;

    if (count >= this.stormThreshold) {
      this.onEvent({
        type: 'storm',
        count,
        requiresSnapshotDiff: true
      });
    } else {
      this.onEvent({
        type: 'batch',
        files: Array.from(this.pendingFiles)
      });
    }

    this.pendingFiles.clear();
  }

  /**
   * Stops the watcher and cancels active debounce timers.
   */
  public stop(): void {
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingFiles.clear();
  }
}
