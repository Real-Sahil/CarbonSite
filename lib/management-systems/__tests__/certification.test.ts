// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => {
  const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), groupBy: vi.fn() });
  return new Proxy({} as Record<string, ReturnType<typeof model>>, { get: (t, k: string) => (t[k] ??= model()) });
});
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/storage", () => ({ presignDownload: vi.fn(async (k: string) => `https://storage.test/${k}`), getObject: vi.fn() }));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  const ctx = { session: { user: { id: "user-a", email: "a@x.test" } }, membership: { role: "admin" } };
  return { ...actual, requireSession: vi.fn().mockResolvedValue(ctx.session), requireOrgMember: vi.fn().mockResolvedValue(ctx) };
});

import { hashToken, newToken, resolveAuditorToken } from "../auditor-access";
import { rowInScope, statementOfApplicability } from "../certification-pack";
import { getFramework } from "../catalogue";
import { integratedView } from "../integrated";

const future = new Date(Date.now() + 86_400_000);
const req = (body?: unknown, method = "GET") =>
  new NextRequest("http://localhost/x", { method, ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}) });

beforeEach(() => {
  vi.clearAllMocks();
  db.msFrameworkAdoption.findMany.mockResolvedValue([{ frameworkSlug: "iso-14001-2026" }]);
});

describe("auditor links", () => {
  it("stores only the token's hash and gives the link once", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/auditor-access/route");
    db.msAuditorAccess.create.mockImplementation(async ({ data }: { data: object }) => ({ id: "aa1", ...data }));
    const res = await POST(req({ name: "J Auditor", company: "Cert Co", frameworks: ["iso-14001-2026"], days: 30 }, "POST"), { params: Promise.resolve({ orgId: "org-a" }) });
    expect(res.status).toBe(201);
    const { url } = await res.json();
    const token = url.split("/ms-audit/")[1];
    const data = db.msAuditorAccess.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(data)).not.toContain(token);
    expect(data.organizationId).toBe("org-a");
  });

  it("refuses frameworks the organisation has not adopted and links over 90 days", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/auditor-access/route");
    db.msFrameworkAdoption.findMany.mockResolvedValue([]);
    expect((await POST(req({ name: "J", frameworks: ["iso-45001-2018"], days: 30 }, "POST"), { params: Promise.resolve({ orgId: "org-a" }) })).status).toBe(422);
    expect((await POST(req({ name: "J", frameworks: ["iso-45001-2018"], days: 365 }, "POST"), { params: Promise.resolve({ orgId: "org-a" }) })).status).toBe(422);
    expect(db.msAuditorAccess.create).not.toHaveBeenCalled();
  });

  it("opens nothing when the token is unknown, expired or revoked", async () => {
    const token = newToken();
    db.msAuditorAccess.findUnique.mockResolvedValue(null);
    expect(await resolveAuditorToken(token)).toBeNull();
    db.msAuditorAccess.findUnique.mockResolvedValue({ id: "aa1", organizationId: "org-a", frameworks: ["iso-14001-2026"], expiresAt: new Date(Date.now() - 1000), revokedAt: null });
    expect(await resolveAuditorToken(token)).toBeNull();
    db.msAuditorAccess.findUnique.mockResolvedValue({ id: "aa1", organizationId: "org-a", frameworks: ["iso-14001-2026"], expiresAt: future, revokedAt: new Date() });
    expect(await resolveAuditorToken(token)).toBeNull();
    expect(await resolveAuditorToken("short")).toBeNull();
    expect(db.msAuditorAccess.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashToken(token) });
  });

  it("downloads only files the link's pack draws on, from the link's organisation", async () => {
    const { GET } = await import("@/app/api/public/ms-audit/[token]/files/[evidenceId]/route");
    const token = newToken();
    db.msAuditorAccess.findUnique.mockResolvedValue({ id: "aa1", organizationId: "org-a", frameworks: ["iso-14001-2026"], expiresAt: future, revokedAt: null });
    db.msEvidenceLink.findMany.mockResolvedValue([{ targetId: "ev-linked" }]);
    db.evidenceFile.findFirst.mockResolvedValue({ storageKey: "org/org-a/evidence/ev-linked/a.pdf", filename: "a.pdf" });

    const ok = await GET(req(), { params: Promise.resolve({ token, evidenceId: "ev-linked" }) });
    expect(ok.status).toBe(307);
    expect(db.msEvidenceLink.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: "org-a", frameworkSlug: { in: ["iso-14001-2026"] } });
    expect(db.evidenceFile.findFirst.mock.calls[0][0].where).toEqual({ id: "ev-linked", organizationId: "org-a" });

    const other = await GET(req(), { params: Promise.resolve({ token, evidenceId: "ev-payroll" }) });
    expect(other.status).toBe(404);
  });
});

describe("certification pack", () => {
  it("keeps register rows with no framework tag or one of the pack's", () => {
    expect(rowInScope({ id: "1" }, ["iso-14001-2026"])).toBe(true);
    expect(rowInScope({ id: "1", frameworks: [] }, ["iso-14001-2026"])).toBe(true);
    expect(rowInScope({ id: "1", frameworks: ["iso-27001-2022"] }, ["iso-14001-2026"])).toBe(false);
    expect(rowInScope({ id: "1", frameworks: ["iso-27001-2022", "iso-14001-2026"] }, ["iso-14001-2026"])).toBe(true);
  });

  it("builds a Statement of Applicability of every Annex A control", () => {
    const f = getFramework("iso-27001-2022")!;
    const soa = statementOfApplicability(
      f,
      [
        { requirementCode: "A.7.1", status: "not_applicable", notes: "Fully remote, no premises", interpretation: null },
        { requirementCode: "A.5.1", status: "implemented", notes: "ISMS policy v3", interpretation: null },
      ],
      [{ requirementCode: "A.5.1", label: "Information security policy" }],
    );
    expect(soa.length).toBe(93);
    expect(soa.find((r) => r.code === "A.7.1")).toMatchObject({ applicable: false, justification: "Fully remote, no premises" });
    expect(soa.find((r) => r.code === "A.5.1")).toMatchObject({ applicable: true, status: "implemented", evidence: "Information security policy" });
  });
});

describe("integrated view", () => {
  it("lines up shared clauses and flags differing statuses", () => {
    const fws = ["iso-14001-2026", "iso-45001-2018", "iso-9001-2026"].map((s) => getFramework(s)!);
    const { rows } = integratedView(
      fws,
      new Map([
        ["iso-14001-2026|9.2.2", "implemented"],
        ["iso-45001-2018|9.2.2", "in_progress"],
      ] as const),
      new Map(),
    );
    const audit = rows.find((r) => r.key === "hls:9.2")!;
    expect(Object.keys(audit.cells).sort()).toEqual(["iso-14001-2026", "iso-45001-2018", "iso-9001-2026"]);
    // 14001's 9.2 is a heading: its 9.2.1 is not started, so the heading is not started.
    expect(audit.cells["iso-14001-2026"].status).toBe("not_started");
    expect(audit.aligned).toBe(true);
    const all = new Map<string, "implemented">(["iso-14001-2026|9.2.1", "iso-14001-2026|9.2.2"].map((k) => [k, "implemented"]));
    expect(integratedView(fws, all, new Map()).rows.find((r) => r.key === "hls:9.2")!.aligned).toBe(false);
  });
});
