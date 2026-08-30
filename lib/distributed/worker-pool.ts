/**
 * Distributed Computation Worker Pool
 *
 * Manages a pool of Web Workers for parallel processing of large datasets.
 * Distributes compute-intensive tasks across multiple threads to maximize CPU utilization.
 */

import { EventEmitter } from "events";

export interface WorkerTask {
  id: string;
  type: "calculate_emissions" | "validate_records" | "aggregate_data" | "estimate_factors";
  data: unknown;
  priority?: number;
}

export interface WorkerResult {
  taskId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

export interface PoolStats {
  totalWorkers: number;
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalDuration: number;
  averageTaskDuration: number;
}

/**
 * Worker pool for distributing tasks across multiple workers.
 * Implements queue-based task distribution with priority support.
 */
export class WorkerPool extends EventEmitter {
  private workers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private activeTasks: Map<string, { startTime: number; worker: Worker }> = new Map();
  private taskHandlers: Map<
    string,
    { resolve: (result: WorkerResult) => void; reject: (error: Error) => void }
  > = new Map();
  private stats = {
    completed: 0,
    failed: 0,
    totalDuration: 0,
  };

  constructor(private workerCount: number = navigator.hardwareConcurrency || 4) {
    super();
    this.initialize();
  }

  private initialize() {
    for (let i = 0; i < this.workerCount; i++) {
      const worker = new Worker(new URL("./computation-worker.ts", import.meta.url), {
        type: "module",
      });

      worker.onmessage = (event) => this.handleWorkerMessage(event);
      worker.onerror = (error) => this.handleWorkerError(error, worker);

      this.workers.push(worker);
    }
  }

  /**
   * Submit a task to the worker pool.
   * Tasks are queued and distributed to available workers.
   */
  submit(task: WorkerTask): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      // Store handlers for later resolution
      this.taskHandlers.set(task.id, { resolve, reject });

      // Add to queue with priority (higher number = higher priority)
      const priority = task.priority || 0;
      const insertIndex = this.taskQueue.findIndex((t) => (t.priority || 0) < priority);

      if (insertIndex === -1) {
        this.taskQueue.push(task);
      } else {
        this.taskQueue.splice(insertIndex, 0, task);
      }

      this.processTasks();
    });
  }

  /**
   * Process queued tasks by distributing to available workers.
   */
  private processTasks() {
    while (this.taskQueue.length > 0 && this.activeTasks.size < this.workerCount) {
      const task = this.taskQueue.shift();
      if (!task) break;

      const availableWorker = this.getAvailableWorker();
      if (!availableWorker) break;

      this.activeTasks.set(task.id, {
        startTime: Date.now(),
        worker: availableWorker,
      });

      availableWorker.postMessage(task);
      this.emit("task_started", task.id);
    }
  }

  /**
   * Get an available worker (one not currently processing a task).
   */
  private getAvailableWorker(): Worker | undefined {
    const activeWorkers = new Set(Array.from(this.activeTasks.values()).map((t) => t.worker));
    return this.workers.find((w) => !activeWorkers.has(w));
  }

  /**
   * Handle message from worker.
   */
  private handleWorkerMessage(event: MessageEvent<WorkerResult>): void {
    const { taskId, success, result, error } = event.data;
    const activeTask = this.activeTasks.get(taskId);
    const handlers = this.taskHandlers.get(taskId);

    if (activeTask) {
      const actualDuration = Date.now() - activeTask.startTime;
      this.activeTasks.delete(taskId);
      this.taskHandlers.delete(taskId);

      const taskResult: WorkerResult = {
        taskId,
        success,
        result,
        error,
        duration: actualDuration,
      };

      if (success) {
        this.stats.completed++;
        this.stats.totalDuration += actualDuration;
        this.emit("task_completed", { taskId, duration: actualDuration });
        handlers?.resolve(taskResult);
      } else {
        this.stats.failed++;
        this.emit("task_failed", { taskId, error });
        handlers?.reject(new Error(error));
      }

      // Process next task
      this.processTasks();
    }
  }

  /**
   * Handle worker error.
   */
  private handleWorkerError(error: ErrorEvent, worker: Worker): void {
    console.error("Worker error:", error.message);

    // Find and fail all tasks assigned to this worker
    const failedTasks = Array.from(this.activeTasks.entries()).filter(([, task]) => task.worker === worker);

    for (const [taskId] of failedTasks) {
      const handlers = this.taskHandlers.get(taskId);
      this.activeTasks.delete(taskId);
      this.taskHandlers.delete(taskId);
      this.stats.failed++;
      this.emit("task_failed", { taskId, error: error.message });
      handlers?.reject(new Error(error.message));
    }

    // Replace worker
    const workerIndex = this.workers.indexOf(worker);
    if (workerIndex !== -1) {
      worker.terminate();
      this.workers.splice(workerIndex, 1);

      const newWorker = new Worker(new URL("./computation-worker.ts", import.meta.url), {
        type: "module",
      });
      newWorker.onmessage = (event) => this.handleWorkerMessage(event);
      newWorker.onerror = (error) => this.handleWorkerError(error, newWorker);
      this.workers.push(newWorker);
    }

    this.processTasks();
  }

  /**
   * Get current pool statistics.
   */
  getStats(): PoolStats {
    return {
      totalWorkers: this.workerCount,
      activeWorkers: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      completedTasks: this.stats.completed,
      failedTasks: this.stats.failed,
      totalDuration: this.stats.totalDuration,
      averageTaskDuration:
        this.stats.completed > 0 ? this.stats.totalDuration / this.stats.completed : 0,
    };
  }

  /**
   * Terminate all workers and clear queue.
   */
  terminate() {
    this.taskQueue = [];
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.activeTasks.clear();
  }

  /**
   * Wait for all tasks to complete.
   */
  async drain(): Promise<void> {
    return new Promise((resolve) => {
      const checkEmpty = () => {
        if (this.taskQueue.length === 0 && this.activeTasks.size === 0) {
          resolve();
        } else {
          setTimeout(checkEmpty, 100);
        }
      };
      checkEmpty();
    });
  }
}

/**
 * Global worker pool instance.
 * Lazily initialized on first use.
 */
let globalPool: WorkerPool;

export function getWorkerPool(workerCount?: number): WorkerPool {
  if (!globalPool) {
    globalPool = new WorkerPool(workerCount);
  }
  return globalPool;
}
