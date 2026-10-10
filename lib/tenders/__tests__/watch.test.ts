// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  tenderWatch: { findMany: vi.fn(), updateMany: vi.fn() },
  tenderOpportunity: { findMany: vi.fn(), createMany: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

const releases = vi.hoisted(() => ({ list: [] as unknown[], from: null as Date | null, failAfter: null as number | null }));
vi.mock("../fts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../fts")>();
  return {
    ...actual,
    fetchTenderReleases: async function* (from: Date) {
      releases.from = from;
      let i = 0;
      for (const r of releases.list) {
        // Simulates the run being cut off (the monitor's 60 s limit) after failAfter releases.
        if (releases.failAfter !== null && i++ >= releases.failAfter) throw new Error("timeout");
        yield r;
      }
    },
  };
});

import { runTenderWatches, WRITE_BATCH } from "../watch";

const now = new Date("2026-09-26T06:00:00Z");
const release = (id: string, cpv: string, deadline: string, date = "2026-09-25T10:00:00Z") => ({
  ocid: `o-${id}`,
  id,
  date,
  tag: ["tender"],
  tender: { title: `Works ${id}`, classification: { scheme: "CPV", id: cpv }, tenderPeriod: { endDate: deadline }, items: [{ deliveryAddresses: [{ region: "UKE12" }] }] },
  buyer: { name: "A Council" },
});
const watch = (org: string, cpv: string[], lastCheckedAt: Date | null = null) => ({ organizationId: org, cpvPrefixes: cpv, regions: [], keywords: [], minValue: null, lastCheckedAt });

beforeEach(() => {
  vi.clearAllMocks();
  releases.failAfter = null;
  db.tenderOpportunity.findMany.mockResolvedValue([]);
  db.tenderOpportunity.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
  db.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
});

describe("runTenderWatches", () => {
  it("records each matching open notice for the organisations it matches", async () => {
    db.tenderWatch.findMany.mockResolvedValue([watch("org-a", ["45"]), watch("org-b", ["71"])]);
    releases.list = [release("000001-2026", "45233000", "2026-10-20T12:00:00Z"), release("000002-2026", "71300000", "2026-10-20T12:00:00Z"), release("000003-2026", "45000000", "2026-09-20T12:00:00Z")];

    const res = await runTenderWatches({ now });

    expect(res).toEqual({ checked: 2, notices: 2, added: 2 });
    const created = db.tenderOpportunity.createMany.mock.calls.flatMap((c) => c[0].data.map((d: { organizationId: string; noticeId: string }) => [d.organizationId, d.noticeId]));
    expect(created).toEqual([["org-a", "000001-2026"], ["org-b", "000002-2026"]]);
    // The closed notice (deadline passed) is not recorded.
    expect(JSON.stringify(created)).not.toContain("000003-2026");
    expect(db.tenderWatch.updateMany).toHaveBeenCalledWith({ where: { organizationId: { in: ["org-a", "org-b"] } }, data: { lastCheckedAt: now } });
  });

  it("updates a notice it already has instead of adding it again, keeping its status", async () => {
    db.tenderWatch.findMany.mockResolvedValue([watch("org-a", ["45"])]);
    releases.list = [release("000001-2026", "45233000", "2026-10-20T12:00:00Z")];
    db.tenderOpportunity.findMany.mockResolvedValue([{ id: "opp-1", organizationId: "org-a", noticeId: "000001-2026" }]);

    const res = await runTenderWatches({ now });

    expect(res.added).toBe(0);
    expect(db.tenderOpportunity.createMany).not.toHaveBeenCalled();
    expect(db.tenderOpportunity.update.mock.calls[0][0].where).toEqual({ id: "opp-1" });
    expect(db.tenderOpportunity.update.mock.calls[0][0].data).not.toHaveProperty("status");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
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

  it("writes a year-sized feed in batches of one page, not a row at a time", async () => {
    db.tenderWatch.findMany.mockResolvedValue([watch("org-a", ["45"])]);
    releases.list = Array.from({ length: 2300 }, (_, i) => release(String(i).padStart(6, "0") + "-2026", "45233000", "2026-10-20T12:00:00Z", new Date(Date.UTC(2026, 8, 20) + i * 60_000).toISOString()));

    const res = await runTenderWatches({ now });

    expect(res).toEqual({ checked: 1, notices: 2300, added: 2300 });
    expect(db.tenderOpportunity.createMany).toHaveBeenCalledTimes(Math.ceil(2300 / WRITE_BATCH));
    expect(db.tenderOpportunity.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it("saves progress as it goes, so a cut-off run resumes where it stopped", async () => {
    db.tenderWatch.findMany.mockResolvedValue([watch("org-a", ["45"])]);
    releases.list = Array.from({ length: 300 }, (_, i) => release(String(i).padStart(6, "0") + "-2026", "45233000", "2026-10-20T12:00:00Z", new Date(Date.UTC(2026, 8, 22) + i * 60_000).toISOString()));
    releases.failAfter = 250;

    await expect(runTenderWatches({ now })).rejects.toThrow("timeout");

    // Two full pages were written before the cut, each followed by a save: the newest release read less a day.
    expect(db.tenderOpportunity.createMany).toHaveBeenCalledTimes(2);
    const saved = db.tenderWatch.updateMany.mock.calls.map((c) => c[0].data.lastCheckedAt as Date);
    expect(saved).toEqual([new Date(Date.UTC(2026, 8, 21, 1, 39)), new Date(Date.UTC(2026, 8, 21, 3, 19))]);
    expect(saved.every((d) => d < now)).toBe(true);

    // The next run starts from that point, not from seven days back.
    releases.failAfter = null;
    releases.list = [];
    db.tenderWatch.findMany.mockResolvedValue([watch("org-a", ["45"], saved[1])]);
    await runTenderWatches({ now });
    expect(releases.from?.toISOString()).toBe("2026-09-21T03:19:00.000Z");
  });
});
