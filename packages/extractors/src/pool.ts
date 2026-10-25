import os from 'node:os';

export enum TaskPriority {
  P0 = 0, // Immediate (Active card in UI / synchronous agent query)
  P1 = 1, // High (Entry points, routes, configs)
  P2 = 2, // Normal (Watcher file change edits)
  P3 = 3  // Background (Deep initial repository indexing)
}

interface QueuedTask {
  id: number;
  priority: TaskPriority;
  run: () => Promise<void>;
  enqueuedAt: number;
}

export interface PriorityWorkerPoolOptions {
  concurrency?: number;
}

export interface PoolMetrics {
  concurrency: number;
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
}

/**
 * 4-tier priority task pool for AST extraction with bounded CPU concurrency.
 * Ensures UI and MCP requests (P0) take immediate precedence over background indexing (P3).
 */
export class PriorityWorkerPool {
  private readonly concurrency: number;
  private activeWorkers = 0;
  private completedTasks = 0;
  private failedTasks = 0;
  private nextTaskId = 1;

  // 4 priority buckets: P0 (highest) to P3 (lowest)
  private queues: Map<TaskPriority, QueuedTask[]> = new Map([
    [TaskPriority.P0, []],
    [TaskPriority.P1, []],
    [TaskPriority.P2, []],
    [TaskPriority.P3, []]
  ]);

  private drainResolvers: (() => void)[] = [];

  constructor(options: PriorityWorkerPoolOptions = {}) {
    const defaultConcurrency = Math.max(
      1,
      Math.min(4, os.availableParallelism ? os.availableParallelism() - 1 : 2)
    );
    this.concurrency = options.concurrency ?? defaultConcurrency;
  }

  /**
   * Enqueues an async task at the specified priority level.
   * Returns a promise that resolves with the task's return value.
   */
  public enqueue<T>(
    task: () => Promise<T>,
    priority: TaskPriority = TaskPriority.P2
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedTask: QueuedTask = {
        id: this.nextTaskId++,
        priority,
        run: async () => {
          try {
            const result = await task();
            this.completedTasks += 1;
            resolve(result);
          } catch (err) {
            this.failedTasks += 1;
            reject(err);
          }
        },
        enqueuedAt: Date.now()
      };

      const bucket = this.queues.get(priority) ?? [];
      bucket.push(queuedTask);
      this.queues.set(priority, bucket);

      this.pump();
    });
  }

  /**
   * Internal scheduler: dispatches tasks from highest priority queue down to lowest.
   */
  private pump(): void {
    while (this.activeWorkers < this.concurrency) {
      const task = this.popNextTask();
      if (!task) break;

      this.activeWorkers += 1;

      task
        .run()
        .finally(() => {
          this.activeWorkers -= 1;
          this.pump();
          this.checkDrain();
        });
    }
  }

  /**
   * Pops the next available task by strict priority (P0 -> P1 -> P2 -> P3).
   */
  private popNextTask(): QueuedTask | null {
    for (const priority of [
      TaskPriority.P0,
      TaskPriority.P1,
      TaskPriority.P2,
      TaskPriority.P3
    ]) {
      const bucket = this.queues.get(priority);
      if (bucket && bucket.length > 0) {
        return bucket.shift() ?? null;
      }
    }
    return null;
  }

  /**
   * Resolves any pending drain promises when all queues and active workers are idle.
   */
  private checkDrain(): void {
    if (this.activeWorkers === 0 && this.getQueuedCount() === 0) {
      while (this.drainResolvers.length > 0) {
        const resolver = this.drainResolvers.shift();
        resolver?.();
      }
    }
  }

  /**
   * Returns the total count of queued tasks awaiting worker execution.
   */
  private getQueuedCount(): number {
    let count = 0;
    for (const bucket of this.queues.values()) {
      count += bucket.length;
    }
    return count;
  }

  /**
   * Returns a promise that resolves when all queued and running tasks have finished.
   */
  public drain(): Promise<void> {
    if (this.activeWorkers === 0 && this.getQueuedCount() === 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.drainResolvers.push(resolve);
    });
  }

  /**
   * Returns live pool metrics.
   */
  public getMetrics(): PoolMetrics {
    return {
      concurrency: this.concurrency,
      activeWorkers: this.activeWorkers,
      queuedTasks: this.getQueuedCount(),
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks
    };
  }
}
