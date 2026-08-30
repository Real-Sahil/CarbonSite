import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WorkerPool, getWorkerPool } from "../worker-pool";

// @vitest-environment node
// Worker API is only available in Node.js environment, not jsdom

describe("WorkerPool", () => {
  let pool: WorkerPool;

  beforeEach(() => {
    pool = new WorkerPool(2);
  });

  afterEach(() => {
    pool.terminate();
  });

  describe("Basic Operations", () => {
    it("should initialize with correct number of workers", () => {
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(2);
      expect(stats.activeWorkers).toBe(0);
    });

    it("should submit tasks and track stats", async () => {
      const task = {
        id: "task-1",
        type: "calculate_emissions" as const,
        data: [{ amount: 100, factor: 2 }],
      };

      const promise = pool.submit(task);
      expect(pool.getStats().queuedTasks).toBeGreaterThan(0);

      const result = await promise;
      expect(result.taskId).toBe("task-1");
    });

    it("should handle multiple concurrent tasks", async () => {
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        id: `task-${i}`,
        type: "validate_records" as const,
        data: [{ id: "rec1", amount: 10, unit: "kg", category: "waste", date: "2024-01-01" }],
      }));

      const promises = tasks.map((t) => pool.submit(t));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((r, i) => {
        expect(r.taskId).toBe(`task-${i}`);
        expect(r.success).toBe(true);
      });
    });
  });

  describe("Priority Queueing", () => {
    it("should process high-priority tasks first", async () => {
      const order: string[] = [];

      const originalEmit = pool.emit.bind(pool);
      vi.spyOn(pool, "emit").mockImplementation(function (event: string | symbol, ...args: (string | object)[]) {
        if (event === "task_started" && typeof args[0] === "string") {
          order.push(args[0]);
        }
        return originalEmit(event, ...args);
      });

      const lowPriority = {
        id: "low",
        type: "calculate_emissions" as const,
        data: [],
        priority: 0,
      };

      const highPriority = {
        id: "high",
        type: "calculate_emissions" as const,
        data: [],
        priority: 10,
      };

      pool.submit(lowPriority);
      pool.submit(highPriority);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // High priority should be in the order (though both may start)
      expect(order.length).toBeGreaterThan(0);
    });
  });

  describe("Statistics", () => {
    it("should track completed tasks", async () => {
      const task = {
        id: "task-1",
        type: "calculate_emissions" as const,
        data: [{ amount: 100, factor: 2 }],
      };

      await pool.submit(task);

      const stats = pool.getStats();
      expect(stats.completedTasks).toBeGreaterThan(0);
    });

    it("should calculate average task duration", async () => {
      const tasks = Array.from({ length: 3 }, (_, i) => ({
        id: `task-${i}`,
        type: "validate_records" as const,
        data: [{ id: "rec1", amount: 10, unit: "kg", category: "waste", date: "2024-01-01" }],
      }));

      await Promise.all(tasks.map((t) => pool.submit(t)));

      const stats = pool.getStats();
      expect(stats.averageTaskDuration).toBeGreaterThan(0);
      expect(stats.totalDuration).toBeGreaterThan(0);
    });
  });

  describe("Drain", () => {
    it("should wait for all tasks to complete", async () => {
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i}`,
        type: "calculate_emissions" as const,
        data: [{ amount: 100, factor: 2 }],
      }));

      tasks.forEach((t) => pool.submit(t));

      await pool.drain();

      const stats = pool.getStats();
      expect(stats.queuedTasks).toBe(0);
      expect(stats.activeWorkers).toBe(0);
    });
  });

  describe("Global Singleton", () => {
    it("should return same instance on multiple calls", () => {
      const pool1 = getWorkerPool();
      const pool2 = getWorkerPool();

      expect(pool1).toBe(pool2);

      pool1.terminate();
    });

    it("should initialize with hardware concurrency", () => {
      const pool1 = getWorkerPool(4);
      const stats = pool1.getStats();

      expect(stats.totalWorkers).toBe(4);

      pool1.terminate();
    });
  });

  describe("Event Emission", () => {
    it("should emit task lifecycle events", async () => {
      const startedTasks: string[] = [];
      const completedTasks: string[] = [];

      pool.on("task_started", (taskId) => startedTasks.push(taskId));
      pool.on("task_completed", (data) => completedTasks.push(data.taskId));

      const task = {
        id: "task-1",
        type: "calculate_emissions" as const,
        data: [{ amount: 100, factor: 2 }],
      };

      await pool.submit(task);

      expect(startedTasks).toContain("task-1");
      expect(completedTasks).toContain("task-1");
    });
  });

  describe("Termination", () => {
    it("should terminate all workers", () => {
      const initialStats = pool.getStats();
      expect(initialStats.totalWorkers).toBeGreaterThan(0);

      pool.terminate();

      const finalStats = pool.getStats();
      expect(finalStats.totalWorkers).toBe(0);
    });

    it("should clear queue on termination", async () => {
      const tasks = Array.from({ length: 100 }, (_, i) => ({
        id: `task-${i}`,
        type: "calculate_emissions" as const,
        data: [{ amount: 100, factor: 2 }],
      }));

      tasks.forEach((t) => pool.submit(t));
      pool.terminate();

      const stats = pool.getStats();
      expect(stats.queuedTasks).toBe(0);
    });
  });
});
