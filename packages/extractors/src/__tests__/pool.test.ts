import { describe, it, expect } from 'vitest';
import {
  PriorityWorkerPool,
  TaskPriority
} from '../index.js';

describe('Priority Worker Pool (SPRINT-2.1)', () => {
  it('executes tasks respecting priority order (P0 > P1 > P2 > P3)', async () => {
    const executionOrder: string[] = [];
    const pool = new PriorityWorkerPool({ concurrency: 1 }); // Serial execution to test queue ordering

    // Pause worker to queue multiple tasks with different priorities
    let unpause: () => void = () => {};
    const blocker = pool.enqueue(
      () =>
        new Promise<void>((resolve) => {
          unpause = resolve;
        }),
      TaskPriority.P0
    );

    // Queue tasks in reverse priority order
    const p3 = pool.enqueue(async () => {
      executionOrder.push('P3_background');
    }, TaskPriority.P3);

    const p2 = pool.enqueue(async () => {
      executionOrder.push('P2_edit');
    }, TaskPriority.P2);

    const p1 = pool.enqueue(async () => {
      executionOrder.push('P1_route');
    }, TaskPriority.P1);

    const p0 = pool.enqueue(async () => {
      executionOrder.push('P0_active_ui');
    }, TaskPriority.P0);

    // Unpause blocker to let queue drain
    unpause();
    await blocker;
    await Promise.all([p0, p1, p2, p3]);

    expect(executionOrder).toEqual([
      'P0_active_ui',
      'P1_route',
      'P2_edit',
      'P3_background'
    ]);
  });

  it('bounds concurrency to configured limit', async () => {
    let peakConcurrency = 0;
    let currentRunning = 0;

    const pool = new PriorityWorkerPool({ concurrency: 3 });

    const tasks = Array.from({ length: 10 }, (_, i) =>
      pool.enqueue(async () => {
        currentRunning += 1;
        peakConcurrency = Math.max(peakConcurrency, currentRunning);
        await new Promise((r) => setTimeout(r, 20));
        currentRunning -= 1;
        return i;
      }, TaskPriority.P2)
    );

    const results = await Promise.all(tasks);
    expect(results).toHaveLength(10);
    expect(peakConcurrency).toBeLessThanOrEqual(3);
  });

  it('isolates errors so a failed task does not crash the pool or block other tasks', async () => {
    const pool = new PriorityWorkerPool({ concurrency: 2 });

    const failingTask = pool.enqueue(async () => {
      throw new Error('AST Syntax Error: Unexpected token');
    }, TaskPriority.P1);

    const successfulTask = pool.enqueue(async () => {
      return { status: 'parsed' };
    }, TaskPriority.P1);

    await expect(failingTask).rejects.toThrow('AST Syntax Error');
    const result = await successfulTask;
    expect(result.status).toBe('parsed');
  });

  it('reports accurate queue metrics', async () => {
    const pool = new PriorityWorkerPool({ concurrency: 1 });
    let release: () => void = () => {};

    const blocker = pool.enqueue(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
      TaskPriority.P0
    );

    pool.enqueue(async () => 'task_1', TaskPriority.P2);
    pool.enqueue(async () => 'task_2', TaskPriority.P3);

    const metricsBefore = pool.getMetrics();
    expect(metricsBefore.activeWorkers).toBe(1);
    expect(metricsBefore.queuedTasks).toBe(2);

    release();
    await blocker;
    await pool.drain();

    const metricsAfter = pool.getMetrics();
    expect(metricsAfter.activeWorkers).toBe(0);
    expect(metricsAfter.queuedTasks).toBe(0);
    expect(metricsAfter.completedTasks).toBe(3);
  });
});
