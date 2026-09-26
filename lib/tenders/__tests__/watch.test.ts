// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  tenderWatch: { findMany: vi.fn(), updateMany: vi.fn() },
  tenderOpportunity: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

const releases = vi.hoisted(() => ({ list: [] as unknown[], from: null as Date | null }));
vi.mock("../fts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../fts")>();
  return {
    ...actual,
    fetchTenderReleases: async function* (from: Date) {
      releases.from = from;
      for (const r of releases.list) yield r;
    },
  };
});

import { runTenderWatches } from "../watch";

const now = new Date("2026-09-26T06:00:00Z");
const release = (id: string, cpv: string, deadline: string) => ({
  ocid: `o-${id}`,
  id,
  date: "2026-09-25T10:00:00Z",
  tag: ["tender"],
  tender: { title: `Works ${id}`, classification: { scheme: "CPV", id: cpv }, tenderPeriod: { endDate: deadline }, items: [{ deliveryAddresses: [{ region: "UKE12" }] }] },
  buyer: { name: "A Council" },
});
const watch = (org: string, cpv: string[], lastCheckedAt: Date | null = null) => ({ organizationId: org, cpvPrefixes: cpv, regions: [], keywords: [], minValue: null, lastCheckedAt });

beforeEach(() => {
  vi.clearAllMocks();
  db.tenderOpportunity.findUnique.mockResolvedValue(null);
});

describe("runTenderWatches", () => {
  it("records each matching open notice for the organisations it matches", async () => {
    db.tenderWatch.findMany.mockResolvedValue([watch("org-a", ["45"]), watch("org-b", ["71"])]);
    releases.list = [release("000001-2026", "45233000", "2026-10-20T12:00:00Z"), release("000002-2026", "71300000", "2026-10-20T12:00:00Z"), release("000003-2026", "45000000", "2026-09-20T12:00:00Z")];

    const res = await runTenderWatches({ now });

    expect(res).toEqual({ checked: 2, notices: 2, added: 2 });
    const created = db.tenderOpportunity.create.mock.calls.map((c) => [c[0].data.organizationId, c[0].data.noticeId]);
    expect(created).toEqual([["org-a", "000001-2026"], ["org-b", "000002-2026"]]);
    // The closed notice (deadline passed) is not recorded.
    expect(JSON.stringify(created)).not.toContain("000003-2026");
    expect(db.tenderWatch.updateMany).toHaveBeenCalledWith({ where: { organizationId: { in: ["org-a", "org-b"] } }, data: { lastCheckedAt: now } });
  });

  it("updates a notice it already has instead of adding it again, keeping its status", async () => {
    db.tenderWatch.findMany.mockResolvedValue([watch("org-a", ["45"])]);
    releases.list = [release("000001-2026", "45233000", "2026-10-20T12:00:00Z")];
    db.tenderOpportunity.findUnique.mockResolvedValue({ id: "opp-1" });

    const res = await runTenderWatches({ now });

    expect(res.added).toBe(0);
    expect(db.tenderOpportunity.create).not.toHaveBeenCalled();
    expect(db.tenderOpportunity.update.mock.calls[0][0].where).toEqual({ id: "opp-1" });
    expect(db.tenderOpportunity.update.mock.calls[0][0].data).not.toHaveProperty("status");
  });

  it("reads from the oldest last check, but never more than 7 days back", async () => {
    db.tenderWatch.findMany.mockResolvedValue([watch("org-a", ["45"], new Date("2026-09-25T06:00:00Z")), watch("org-b", ["45"], new Date("2026-01-01T00:00:00Z"))]);
    releases.list = [];
    await runTenderWatches({ now });
    expect(releases.from?.toISOString()).toBe("2026-09-19T06:00:00.000Z");
  });

  it("checks one organisation's watch when asked", async () => {
    db.tenderWatch.findMany.mockResolvedValue([]);
    await runTenderWatches({ organizationId: "org-a", now });
    expect(db.tenderWatch.findMany.mock.calls[0][0].where).toEqual({ enabled: true, organizationId: "org-a" });
  });
});
