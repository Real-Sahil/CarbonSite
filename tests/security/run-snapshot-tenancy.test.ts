// @vitest-environment node
/**
 * Two organisations: a member of org B names org A's calculation run or snapshot id in an org B URL.
 * Every route must answer 404 and write nothing, and a same-org call must still work (so the 404s are
 * the tenancy check and not a broken fixture).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const runs = [
  { id: "run-a", organizationId: "org-a", status: "running", totalRecordCount: 1, processedRecordCount: 0 },
  { id: "run-b", organizationId: "org-b", status: "running", totalRecordCount: 1, processedRecordCount: 0 },
];
const snapshots = [
  { id: "snap-a", organizationId: "org-a", publishedByUserId: "pub", verificationStatus: "pending", version: 1 },
  { id: "snap-b", organizationId: "org-b", publishedByUserId: "pub", verificationStatus: "pending", version: 1 },
];

const match = (rows: Record<string, unknown>[], where: Record<string, unknown>) =>
  rows.find((r) => Object.entries(where).every(([k, v]) => typeof v !== "string" || r[k] === v)) ?? null;

const db = vi.hoisted(() => ({
  calculationRun: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  publishedSnapshot: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  emissionCalculation: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/jobs/dispatch", () => ({ dispatchCalculation: vi.fn(async () => {}) }));
vi.mock("@/lib/auth/session", () => ({
  ROLE_GROUPS: { dataReaders: ["admin"], editor: ["admin"] },
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "user-b" } } })),
}));

import { GET as getRun, PATCH as cancelRun } from "@/app/api/orgs/[orgId]/calculation-runs/[runId]/route";
import { POST as continueRun } from "@/app/api/orgs/[orgId]/calculation-runs/[runId]/continue/route";
import { POST as shareSnapshot, DELETE as unshareSnapshot } from "@/app/api/orgs/[orgId]/snapshots/[snapshotId]/share/route";
import { POST as verifySnapshot } from "@/app/api/orgs/[orgId]/snapshots/[snapshotId]/verify/route";
import { POST as createScenario } from "@/app/api/orgs/[orgId]/scenarios/route";

const req = (body?: unknown) =>
  new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify(body ?? {}) });
const runCtx = (orgId: string, runId: string) => ({ params: Promise.resolve({ orgId, runId }) });
const snapCtx = (orgId: string, snapshotId: string) => ({ params: Promise.resolve({ orgId, snapshotId }) });

beforeEach(() => {
  vi.clearAllMocks();
  db.calculationRun.findUnique.mockImplementation(async ({ where }) => match(runs, where));
  db.calculationRun.findFirst.mockImplementation(async ({ where }) => match(runs, where));
  db.calculationRun.update.mockResolvedValue({});
  db.publishedSnapshot.findUnique.mockImplementation(async ({ where }) => match(snapshots, where));
  db.publishedSnapshot.findFirst.mockImplementation(async ({ where }) => match(snapshots, where));
  db.publishedSnapshot.update.mockResolvedValue({ shareToken: "t", shareTokenExpiresAt: new Date() });
  db.emissionCalculation.findMany.mockResolvedValue([]);
});

describe("org B cannot reach org A's runs and snapshots", () => {
  it("run GET", async () => {
    expect((await getRun(req(), runCtx("org-b", "run-a"))).status).toBe(404);
  });
  it("run cancel writes nothing", async () => {
    expect((await cancelRun(req({ action: "cancel" }), runCtx("org-b", "run-a"))).status).toBe(404);
    expect(db.calculationRun.update).not.toHaveBeenCalled();
  });
  it("run continue dispatches nothing", async () => {
    const { dispatchCalculation } = await import("@/lib/jobs/dispatch");
    expect((await continueRun(req(), runCtx("org-b", "run-a"))).status).toBe(404);
    expect(dispatchCalculation).not.toHaveBeenCalled();
  });
  it("snapshot share and revoke write nothing", async () => {
    expect((await shareSnapshot(req({}), snapCtx("org-b", "snap-a"))).status).toBe(404);
    expect((await unshareSnapshot(req(), snapCtx("org-b", "snap-a"))).status).toBe(404);
    expect(db.publishedSnapshot.update).not.toHaveBeenCalled();
  });
  it("snapshot verify writes nothing", async () => {
    const res = await verifySnapshot(req({ action: "approved" }), snapCtx("org-b", "snap-a"));
    expect(res.status).toBe(404);
    expect(db.publishedSnapshot.update).not.toHaveBeenCalled();
  });
  it("scenario on another org's run reads no emissions", async () => {
    const res = await createScenario(
      req({ calculationRunId: "run-a", adjustments: [{ reductionPercent: 10 }] }),
      { params: Promise.resolve({ orgId: "org-b" }) },
    );
    expect(res.status).toBe(404);
    expect(db.emissionCalculation.findMany).not.toHaveBeenCalled();
  });
});

describe("same org still works", () => {
  it("run GET and snapshot share succeed for the owner", async () => {
    db.calculationRun.findUnique.mockResolvedValueOnce({ ...runs[1], reportingPeriod: null });
    expect((await getRun(req(), runCtx("org-b", "run-b"))).status).toBe(200);
    expect((await shareSnapshot(req({}), snapCtx("org-b", "snap-b"))).status).toBe(200);
    expect(db.publishedSnapshot.update).toHaveBeenCalledTimes(1);
  });
});
