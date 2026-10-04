// @vitest-environment node
/**
 * Report narratives and AI insight routes: editors write, reviewers read, every
 * period is looked up inside the organisation, AI routes refuse when the
 * organisation has not turned AI assistance on and never call a model then.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    reportingPeriod: { findFirst: vi.fn(), findMany: vi.fn() },
    reportNarrative: { findFirst: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}));
const auth = vi.hoisted(() => ({ calls: [] as string[][] }));
const llm = vi.hoisted(() => ({ enabled: false, complete: vi.fn() }));
const audit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: audit }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async (_org: string, ...roles: string[]) => {
    auth.calls.push(roles);
    return { session: { user: { id: "u1" } }, membership: { role: "editor" } };
  }),
  ROLE_GROUPS: { editor: ["editor"], reviewersAndEditors: ["editor", "reviewer"], dataReaders: ["editor", "viewer"] },
  AuthError: class AuthError extends Error {},
}));
vi.mock("@/lib/llm/org-consent", () => ({ aiAssistEnabled: vi.fn(async () => llm.enabled) }));
vi.mock("@/lib/llm/client", () => ({ llmClient: { complete: llm.complete, isConfigured: () => true } }));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn(async () => null) }));
vi.mock("@/lib/dashboard/slice-filter", () => ({ loadPeriodCategoryTotals: vi.fn(async () => ({ current: [{ id: "a", label: "A", kg: 5000 }], previous: [{ id: "a", label: "A", kg: 8000 }] })) }));

import { DELETE, GET, PUT } from "@/app/api/orgs/[orgId]/report-narratives/[periodId]/route";
import { POST as DRAFT } from "@/app/api/orgs/[orgId]/report-narratives/[periodId]/draft/route";
import { POST as EXPLAIN } from "@/app/api/orgs/[orgId]/insights/explain-change/route";

const ctx = { params: Promise.resolve({ orgId: "org1", periodId: "p1" }) };
const body = { executiveSummary: "Ours.", keyFindings: ["One"], recommendations: "Do it.", aiDrafted: true };
const req = (method: string, b?: unknown) => new NextRequest("http://x/api", { method, body: b === undefined ? undefined : JSON.stringify(b) });

beforeEach(() => {
  Object.values(db.prisma).forEach((m) => Object.values(m).forEach((f) => f.mockReset()));
  audit.mockReset();
  llm.complete.mockReset();
  llm.enabled = false;
  auth.calls.length = 0;
  db.prisma.reportingPeriod.findFirst.mockResolvedValue({ id: "p1", label: "FY2025" });
});

describe("report narrative API", () => {
  it("reads for reviewers and editors, writes and deletes for editors only", async () => {
    db.prisma.reportNarrative.findFirst.mockResolvedValue(null);
    await GET(req("GET"), ctx);
    await PUT(req("PUT", body), ctx);
    await DELETE(req("DELETE"), ctx);
    expect(auth.calls).toEqual([["editor", "reviewer"], ["editor"], ["editor"]]);
  });

  it("looks the period up inside the organisation: a foreign period is 404 and nothing is written", async () => {
    db.prisma.reportingPeriod.findFirst.mockResolvedValue(null);
    expect((await PUT(req("PUT", body), ctx)).status).toBe(404);
    expect(db.prisma.reportingPeriod.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", organizationId: "org1" } }));
    expect(db.prisma.reportNarrative.upsert).not.toHaveBeenCalled();
    expect((await DELETE(req("DELETE"), ctx)).status).toBe(404);
    expect(db.prisma.reportNarrative.deleteMany).not.toHaveBeenCalled();
  });

  it("saves under the organisation and period with the author, and audit-logs it", async () => {
    expect((await PUT(req("PUT", body), ctx)).status).toBe(200);
    expect(db.prisma.reportNarrative.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_reportingPeriodId: { organizationId: "org1", reportingPeriodId: "p1" } },
        create: expect.objectContaining({ organizationId: "org1", reportingPeriodId: "p1", updatedByUserId: "u1", aiDrafted: true }),
      }),
    );
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "report_narrative.saved", organizationId: "org1" }));
  });

  it("refuses over-long text and too many findings", async () => {
    expect((await PUT(req("PUT", { ...body, executiveSummary: "x".repeat(4001) }), ctx)).status).toBeGreaterThanOrEqual(400);
    expect((await PUT(req("PUT", { ...body, keyFindings: Array(13).fill("x") }), ctx)).status).toBeGreaterThanOrEqual(400);
    expect(db.prisma.reportNarrative.upsert).not.toHaveBeenCalled();
  });
});

describe("AI routes stay off unless the organisation turned AI assistance on", () => {
  it("the draft route answers 409 and never calls a model", async () => {
    const res = await DRAFT(req("POST"), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("AI_ASSIST_OFF");
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it("explain-change returns the plain summary with ai: true but no model call when AI is off", async () => {
    db.prisma.organization.findUnique.mockResolvedValue({ hqCountry: "GB", reportingCurrency: "GBP" });
    db.prisma.reportingPeriod.findMany.mockResolvedValue([{ id: "p1", label: "FY2025" }, { id: "p0", label: "FY2024" }]);
    const res = await EXPLAIN(req("POST", { currentPeriodId: "p1", previousPeriodId: "p0", ai: true }), { params: Promise.resolve({ orgId: "org1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sentences[0]).toContain("fell from 8.0 tCO2e");
    expect(json.ai).toBeNull();
    expect(json.aiNote).toContain("off");
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it("explain-change refuses a period of another organisation", async () => {
    db.prisma.reportingPeriod.findFirst.mockResolvedValue(null);
    const res = await EXPLAIN(req("POST", { currentPeriodId: "foreign", previousPeriodId: "p0" }), { params: Promise.resolve({ orgId: "org1" }) });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(db.prisma.reportNarrative.findFirst).not.toHaveBeenCalled();
  });
});
