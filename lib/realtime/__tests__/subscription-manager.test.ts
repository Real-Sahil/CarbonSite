import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  subscribeToDashboardUpdates,
  broadcastDashboardUpdate,
  getSubscriberCount,
  getTotalSubscriptions,
  clearAllSubscriptions,
  type DashboardUpdate,
} from "../subscription-manager";

describe("subscription-manager", () => {
  beforeEach(() => {
    clearAllSubscriptions();
  });

  afterEach(() => {
    clearAllSubscriptions();
  });

  describe("subscribeToDashboardUpdates", () => {
    it("adds a subscriber for an organization", () => {
      const callback = vi.fn();
      subscribeToDashboardUpdates("org-1", callback);
      expect(getSubscriberCount("org-1")).toBe(1);
    });

    it("allows multiple subscribers for the same organization", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      subscribeToDashboardUpdates("org-1", callback1);
      subscribeToDashboardUpdates("org-1", callback2);
      expect(getSubscriberCount("org-1")).toBe(2);
    });

    it("allows subscribers for different organizations", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      subscribeToDashboardUpdates("org-1", callback1);
      subscribeToDashboardUpdates("org-2", callback2);
      expect(getSubscriberCount("org-1")).toBe(1);
      expect(getSubscriberCount("org-2")).toBe(1);
    });

    it("returns an unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToDashboardUpdates("org-1", callback);
      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
      expect(getSubscriberCount("org-1")).toBe(0);
    });

    it("removes organization when last subscriber unsubscribes", () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToDashboardUpdates("org-1", callback);
      unsubscribe();
      // Should not throw when checking non-existent org
      expect(getSubscriberCount("org-1")).toBe(0);
    });
  });

  describe("broadcastDashboardUpdate", () => {
    it("sends update to all subscribers of an organization", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      subscribeToDashboardUpdates("org-1", callback1);
      subscribeToDashboardUpdates("org-1", callback2);

      const update: DashboardUpdate = {
        type: "calculation_progress",
        organizationId: "org-1",
        data: { totalCo2e: 1000 },
        timestamp: new Date().toISOString(),
      };

      broadcastDashboardUpdate(update);

      expect(callback1).toHaveBeenCalledWith(update);
      expect(callback2).toHaveBeenCalledWith(update);
    });

    it("only sends to subscribers of the matching organization", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      subscribeToDashboardUpdates("org-1", callback1);
      subscribeToDashboardUpdates("org-2", callback2);

      const update: DashboardUpdate = {
        type: "calculation_progress",
        organizationId: "org-1",
        data: { totalCo2e: 1000 },
        timestamp: new Date().toISOString(),
      };

      broadcastDashboardUpdate(update);

      expect(callback1).toHaveBeenCalledWith(update);
      expect(callback2).not.toHaveBeenCalled();
    });

    it("handles updates with no subscribers gracefully", () => {
      const update: DashboardUpdate = {
        type: "calculation_progress",
        organizationId: "org-1",
        data: { totalCo2e: 1000 },
        timestamp: new Date().toISOString(),
      };

      // Should not throw
      expect(() => broadcastDashboardUpdate(update)).not.toThrow();
    });

    it("catches errors from individual subscriber callbacks", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Test error");
      });
      const normalCallback = vi.fn();
      subscribeToDashboardUpdates("org-1", errorCallback);
      subscribeToDashboardUpdates("org-1", normalCallback);

      const update: DashboardUpdate = {
        type: "calculation_progress",
        organizationId: "org-1",
        data: { totalCo2e: 1000 },
        timestamp: new Date().toISOString(),
      };

      // Should not throw even if one callback errors
      expect(() => broadcastDashboardUpdate(update)).not.toThrow();

      // Both callbacks should be called
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe("getSubscriberCount", () => {
    it("returns 0 for organizations with no subscribers", () => {
      expect(getSubscriberCount("org-1")).toBe(0);
    });

    it("returns correct count for organization with subscribers", () => {
      subscribeToDashboardUpdates("org-1", vi.fn());
      subscribeToDashboardUpdates("org-1", vi.fn());
      subscribeToDashboardUpdates("org-1", vi.fn());
      expect(getSubscriberCount("org-1")).toBe(3);
    });
  });

  describe("getTotalSubscriptions", () => {
    it("returns 0 when no subscribers exist", () => {
      expect(getTotalSubscriptions()).toBe(0);
    });

    it("returns total subscriptions across all organizations", () => {
      subscribeToDashboardUpdates("org-1", vi.fn());
      subscribeToDashboardUpdates("org-1", vi.fn());
      subscribeToDashboardUpdates("org-2", vi.fn());
      subscribeToDashboardUpdates("org-3", vi.fn());
      expect(getTotalSubscriptions()).toBe(4);
    });
  });

  describe("clearAllSubscriptions", () => {
    it("removes all subscribers", () => {
      subscribeToDashboardUpdates("org-1", vi.fn());
      subscribeToDashboardUpdates("org-2", vi.fn());
      expect(getTotalSubscriptions()).toBe(2);

      clearAllSubscriptions();
      expect(getTotalSubscriptions()).toBe(0);
    });
  });
});
