import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { calculationRun: { findFirst: vi.fn() }, emissionCalculation: { findMany: vi.fn() } };

// Two runs: the old one is mostly estimated, the latest is all metered.
const rows = [
  { calculationRunId: "run-old", totalCo2e: 900, activityRecord: { dataOrigin: "estimated" } },
  { calculationRunId: "run-latest", totalCo2e: 100, activityRecord: { dataOrigin: "metered" } },
];

async function run() {
  const { runResolver } = await import("@/lib/compliance/datapoint-resolvers");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return runResolver("primary_data_share_disclosed", "org-a", db as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  db.emissionCalculation.findMany.mockImplementation(async ({ where }: { where: { calculationRunId?: string } }) =>
    rows
      .filter((r) => !where.calculationRunId || r.calculationRunId === where.calculationRunId)
      .map(({ totalCo2e, activityRecord }) => ({ totalCo2e, activityRecord })),
  );
});

describe("primary data share resolver", () => {
  it("is a gap with no succeeded run, and reads no calculations", async () => {
    db.calculationRun.findFirst.mockResolvedValue(null);
    expect((await run())?.status).toBe("gap");
    expect(db.emissionCalculation.findMany).not.toHaveBeenCalled();
  });

  it("reads the latest succeeded run only, so old runs do not dilute the share", async () => {
    db.calculationRun.findFirst.mockResolvedValue({ id: "run-latest" });
    const r = await run();
    expect(db.calculationRun.findFirst.mock.calls[0][0].where).toEqual({ organizationId: "org-a", status: "succeeded" });
    expect(db.emissionCalculation.findMany.mock.calls[0][0].where).toEqual({
      organizationId: "org-a",
      calculationRunId: "run-latest",
    });
    expect(r?.status).toBe("satisfied");
    expect(r?.evidenceSummary).toContain("100.0%");
  });
});
