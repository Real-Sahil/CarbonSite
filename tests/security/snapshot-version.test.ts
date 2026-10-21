// @vitest-environment node
/** Snapshot version allocation takes the per-period advisory lock before reading the latest version. */
import { describe, expect, it, vi } from "vitest";
import { nextSnapshotVersion } from "@/lib/calculation/snapshot-version";

const txWith = (latest: { version: number } | null) => {
  const order: string[] = [];
  const tx = {
    $executeRaw: vi.fn(async () => {
      order.push("lock");
      return 1;
    }),
    publishedSnapshot: {
      findFirst: vi.fn(async () => {
        order.push("read");
        return latest;
      }),
    },
  };
  return { tx, order };
};

describe("nextSnapshotVersion", () => {
  it("locks before reading, and returns latest + 1 scoped to org and period", async () => {
    const { tx, order } = txWith({ version: 4 });
    const v = await nextSnapshotVersion(tx as never, "org-a", "p-1");
    expect(v).toBe(5);
    expect(order).toEqual(["lock", "read"]);
    expect(tx.publishedSnapshot.findFirst.mock.calls[0][0].where).toEqual({
      organizationId: "org-a",
      reportingPeriodId: "p-1",
    });
  });

  it("starts at 1 when the period has no snapshot", async () => {
    const { tx } = txWith(null);
    expect(await nextSnapshotVersion(tx as never, "org-a", "p-1")).toBe(1);
  });
});
