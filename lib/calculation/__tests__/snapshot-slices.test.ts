// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { copyLiveSlicesToSnapshot } from "../snapshot-slices";

function fakeTx(rows: Array<Record<string, unknown>>) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const createMany = vi.fn().mockResolvedValue({ count: 0 });
  return { tx: { dashboardSlice: { findMany, createMany } } as unknown as Prisma.TransactionClient, findMany, createMany };
}

const row = (i: number) => ({
  scope: 1, scope2Method: null, emissionCategoryId: "c", facilityId: null, siteId: `s${i}`,
  contractId: null, supplierKey: null, month: null, totalCo2e: i, recordCount: 1,
});

describe("copyLiveSlicesToSnapshot", () => {
  it("reads only this organisation's live rows and stamps the snapshot on the copies", async () => {
    const { tx, findMany, createMany } = fakeTx([row(1), row(2)]);
    await copyLiveSlicesToSnapshot(tx, "org-1", "per-1", "snap-1");
    expect(findMany.mock.calls[0][0].where).toEqual({ organizationId: "org-1", reportingPeriodId: "per-1", snapshotId: null });
    const data = createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(2);
    expect(data.every((d: Record<string, unknown>) => d.snapshotId === "snap-1" && d.organizationId === "org-1")).toBe(true);
  });

  it("copies large periods in chunks and writes nothing when there are no slices", async () => {
    const many = fakeTx(Array.from({ length: 4500 }, (_, i) => row(i)));
    await copyLiveSlicesToSnapshot(many.tx, "o", "p", "s");
    expect(many.createMany.mock.calls.map((c) => c[0].data.length)).toEqual([2000, 2000, 500]);
    const none = fakeTx([]);
    await copyLiveSlicesToSnapshot(none.tx, "o", "p", "s");
    expect(none.createMany).not.toHaveBeenCalled();
  });
});
