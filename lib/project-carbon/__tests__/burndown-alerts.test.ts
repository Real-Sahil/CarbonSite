// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findBudgets: vi.fn(),
  findMembers: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  dispatch: vi.fn(),
  load: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    carbonBudget: { findMany: mocks.findBudgets, updateMany: mocks.updateMany, update: mocks.update },
    organizationMembership: { findMany: mocks.findMembers },
  },
}));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/auth/session", () => ({ ROLE_GROUPS: { editor: ["editor"], projectManagers: ["manager"] } }));
vi.mock("@/lib/jobs/dispatch", () => ({ dispatchNotification: mocks.dispatch }));
vi.mock("@/lib/observability", () => ({ getLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }) }));
vi.mock("../burndown-load", () => ({ loadProjectBurndown: mocks.load }));

import { processCarbonBudgetAlerts } from "../burndown-alerts";

describe("processCarbonBudgetAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findBudgets.mockResolvedValue([
      { id: "b1", organizationId: "org1", projectId: "p1", forecastAlertLevel: null, project: { name: "P", contractId: null } },
    ]);
    mocks.load.mockResolvedValue({ status: "over", reasons: [], forecastAtCompletion: 1, method: "run_rate", actualToDate: 1, budgetTco2e: 1 });
    mocks.findMembers.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
  });

  it("leaves the alert level unchanged when every send fails", async () => {
    mocks.dispatch.mockRejectedValue(new Error("down"));
    const r = await processCarbonBudgetAlerts();
    expect(r.alerted).toBe(0);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("records the level, scoped to the organisation, once someone was reached", async () => {
    mocks.dispatch.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(undefined);
    const r = await processCarbonBudgetAlerts();
    expect(r.alerted).toBe(1);
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "b1", organizationId: "org1" } }),
    );
  });
});
