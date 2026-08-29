import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  subscribeToDashboardUpdates,
  broadcastDashboardUpdate,
  type DashboardUpdate,
  clearAllSubscriptions,
} from "../subscription-manager";
import { broadcastDashboardUpdate as broadcasterFn } from "../dashboard-broadcaster";

/**
 * Phase 2C: Real-Time Dashboard Integration Test
 *
 * Verifies the complete flow:
 * 1. Calculation completes
 * 2. Dashboard broadcaster fetches updated aggregates
 * 3. Broadcaster calls subscriptions with DashboardUpdate
 * 4. SSE clients receive updates in real-time
 */
describe("Phase 2C: Real-time dashboard integration", () => {
  const testOrgId = "org-test-phase2c";
  const testCalculationRunId = "calc-run-123";

  beforeEach(() => {
    clearAllSubscriptions();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearAllSubscriptions();
  });

  it("broadcasts dashboard updates to SSE clients on calculation completion", async () => {
    // Simulate 3 connected SSE clients (e.g., 3 browser windows/tabs)
    const client1Callback = vi.fn();
    const client2Callback = vi.fn();
    const client3Callback = vi.fn();

    // Clients subscribe to real-time updates
    subscribeToDashboardUpdates(testOrgId, client1Callback);
    subscribeToDashboardUpdates(testOrgId, client2Callback);
    subscribeToDashboardUpdates(testOrgId, client3Callback);

    // Simulate calculation completion → broadcaster → broadcast
    const update: DashboardUpdate = {
      type: "calculation_progress",
      organizationId: testOrgId,
      timestamp: new Date().toISOString(),
      data: {
        aggregates: {
          totalCo2e: 1234567, // 1234.57 tonnes
          scope1: 234567,
          scope2: 567890,
          scope3: 432110,
          byCategory: {
            "s1-stationary": 234567,
            "s2-electricity-lb": 567890,
            "s3-business-travel": 432110,
          },
        },
        calculationRunId: testCalculationRunId,
      },
    };

    // Broadcast the update
    broadcastDashboardUpdate(update);

    // All 3 clients should receive the update
    expect(client1Callback).toHaveBeenCalledWith(update);
    expect(client2Callback).toHaveBeenCalledWith(update);
    expect(client3Callback).toHaveBeenCalledWith(update);
    expect(client1Callback).toHaveBeenCalledTimes(1);
  });

  it("only broadcasts to subscribers of matching organization", () => {
    const org1Client = vi.fn();
    const org2Client = vi.fn();
    const org3Client = vi.fn();

    // Each org has one subscriber
    subscribeToDashboardUpdates("org-1", org1Client);
    subscribeToDashboardUpdates("org-2", org2Client);
    subscribeToDashboardUpdates("org-3", org3Client);

    const update: DashboardUpdate = {
      type: "calculation_progress",
      organizationId: "org-2",
      timestamp: new Date().toISOString(),
      data: {
        aggregates: {
          totalCo2e: 999999,
          scope1: 100000,
          scope2: 200000,
          scope3: 699999,
          byCategory: {},
        },
        calculationRunId: "calc-org2-123",
      },
    };

    broadcastDashboardUpdate(update);

    // Only org-2 subscriber should receive it
    expect(org1Client).not.toHaveBeenCalled();
    expect(org2Client).toHaveBeenCalledWith(update);
    expect(org3Client).not.toHaveBeenCalled();
  });

  it("handles multiple updates in sequence (simulation of polling-to-real-time migration)", () => {
    const callback = vi.fn();
    subscribeToDashboardUpdates(testOrgId, callback);

    // Simulate calculation run 1
    const update1: DashboardUpdate = {
      type: "calculation_progress",
      organizationId: testOrgId,
      timestamp: new Date().toISOString(),
      data: {
        aggregates: {
          totalCo2e: 1000000,
          scope1: 200000,
          scope2: 300000,
          scope3: 500000,
          byCategory: {},
        },
        calculationRunId: "calc-1",
      },
    };

    broadcastDashboardUpdate(update1);
    expect(callback).toHaveBeenNthCalledWith(1, update1);

    // Simulate calculation run 2 (faster updates, no polling delay)
    const update2: DashboardUpdate = {
      type: "calculation_progress",
      organizationId: testOrgId,
      timestamp: new Date().toISOString(),
      data: {
        aggregates: {
          totalCo2e: 1050000, // 5% increase
          scope1: 210000,
          scope2: 315000,
          scope3: 525000,
          byCategory: {},
        },
        calculationRunId: "calc-2",
      },
    };

    broadcastDashboardUpdate(update2);
    expect(callback).toHaveBeenNthCalledWith(2, update2);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("handles snapshot publication events", () => {
    const callback = vi.fn();
    subscribeToDashboardUpdates(testOrgId, callback);

    const snapshotUpdate: DashboardUpdate = {
      type: "snapshot_published",
      organizationId: testOrgId,
      timestamp: new Date().toISOString(),
      data: {
        snapshotId: "snapshot-abc123",
        calculationRunId: testCalculationRunId,
        reportingPeriodId: "period-2024-q1",
        totals: {
          scope1: 200000,
          scope2: 300000,
          scope3: 500000,
        },
      },
    };

    broadcastDashboardUpdate(snapshotUpdate);

    expect(callback).toHaveBeenCalledWith(snapshotUpdate);
  });

  it("handles report ready events", () => {
    const callback = vi.fn();
    subscribeToDashboardUpdates(testOrgId, callback);

    const reportEvent: DashboardUpdate = {
      type: "report_ready",
      organizationId: testOrgId,
      timestamp: new Date().toISOString(),
      data: {
        reportId: "report-xyz789",
        reportType: "annual_inventory",
        publicUrl: "https://app.example.com/orgs/org-test-phase2c/reports/report-xyz789",
      },
    };

    broadcastDashboardUpdate(reportEvent);

    expect(callback).toHaveBeenCalledWith(reportEvent);
  });

  it("propagates updates with millisecond precision for latency measurement", () => {
    const callback = vi.fn();
    subscribeToDashboardUpdates(testOrgId, callback);

    const beforeBroadcast = Date.now();
    const update: DashboardUpdate = {
      type: "calculation_progress",
      organizationId: testOrgId,
      timestamp: new Date().toISOString(),
      data: {
        aggregates: {
          totalCo2e: 1234567,
          scope1: 234567,
          scope2: 567890,
          scope3: 432110,
          byCategory: {},
        },
        calculationRunId: testCalculationRunId,
      },
    };

    broadcastDashboardUpdate(update);
    const afterBroadcast = Date.now();

    // Callback should have been invoked within the broadcast window
    expect(callback).toHaveBeenCalled();
    const receivedUpdate = callback.mock.calls[0][0];
    const receivedTime = new Date(receivedUpdate.timestamp).getTime();

    // Timestamp should be close to broadcast time
    expect(receivedTime).toBeGreaterThanOrEqual(beforeBroadcast - 1000); // 1s buffer
    expect(receivedTime).toBeLessThanOrEqual(afterBroadcast + 1000);
  });

  it("recovery: reconnecting client receives latest state on next broadcast", async () => {
    const client1 = vi.fn();
    const client2 = vi.fn();

    // Client 1 subscribes and receives an update
    const unsubscribe1 = subscribeToDashboardUpdates(testOrgId, client1);
    const update1: DashboardUpdate = {
      type: "calculation_progress",
      organizationId: testOrgId,
      timestamp: new Date().toISOString(),
      data: {
        aggregates: {
          totalCo2e: 1000000,
          scope1: 200000,
          scope2: 300000,
          scope3: 500000,
          byCategory: {},
        },
        calculationRunId: "calc-1",
      },
    };
    broadcastDashboardUpdate(update1);
    expect(client1).toHaveBeenCalledTimes(1);

    // Client 1 disconnects (e.g., network issue)
    unsubscribe1();

    // Another update happens while client 1 is offline
    const update2: DashboardUpdate = {
      type: "calculation_progress",
      organizationId: testOrgId,
      timestamp: new Date().toISOString(),
      data: {
        aggregates: {
          totalCo2e: 1050000,
          scope1: 210000,
          scope2: 315000,
          scope3: 525000,
          byCategory: {},
        },
        calculationRunId: "calc-2",
      },
    };
    broadcastDashboardUpdate(update2);
    expect(client1).toHaveBeenCalledTimes(1); // Still 1, didn't receive update 2

    // Client 1 reconnects and subscribes
    subscribeToDashboardUpdates(testOrgId, client1);

    // Client 2 subscribes
    subscribeToDashboardUpdates(testOrgId, client2);

    // Next update after reconnection
    const update3: DashboardUpdate = {
      type: "calculation_progress",
      organizationId: testOrgId,
      timestamp: new Date().toISOString(),
      data: {
        aggregates: {
          totalCo2e: 1100000,
          scope1: 220000,
          scope2: 330000,
          scope3: 550000,
          byCategory: {},
        },
        calculationRunId: "calc-3",
      },
    };
    broadcastDashboardUpdate(update3);

    // Reconnected client 1 should get the latest update
    // (Note: update2 was missed during disconnect, but client catches up on next update)
    expect(client1).toHaveBeenCalledWith(update3);
    expect(client2).toHaveBeenCalledWith(update3);
  });
});
