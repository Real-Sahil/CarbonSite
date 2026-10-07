// @vitest-environment node
/** Waste documents: team uploads stay inside the organisation, contractor uploads wait as pending, review is org-scoped. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    wasteDocument: { create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    submissionLink: { findUnique: vi.fn(), update: vi.fn() },
    billInboxItem: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn().mockResolvedValue(null) }));
const store = vi.hoisted(() => ({ storeEvidenceFile: vi.fn() }));
vi.mock("@/lib/evidence/store", () => store);
const session = vi.hoisted(() => ({
  requireOrgMember: vi.fn(),
  AuthError: class AuthError extends Error {},
  ROLE_GROUPS: { editor: ["admin"], projectManagers: ["project_manager"], dataReaders: ["admin", "viewer"] },
}));
vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/security/org-refs", () => ({
  orgRefsError: vi.fn(async (_o: string, r: { projectId?: string | null }) =>
    r.projectId === "proj-of-org-b" ? new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 }) : null),
}));

import { POST } from "@/app/api/orgs/[orgId]/waste/documents/route";
import { PATCH } from "@/app/api/orgs/[orgId]/waste/documents/[id]/route";
import { POST as UPLOAD } from "@/app/api/public/submit/[token]/route";

const pdf = new TextEncoder().encode("%PDF-1.7 x");
const ctx = { params: Promise.resolve({ orgId: "org-a" }) };
function form(extra: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  f.append("file", new File([pdf as BlobPart], "wtn.pdf", { type: "application/pdf" }));
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  session.requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "admin" } });
  store.storeEvidenceFile.mockResolvedValue({ id: "ev1", duplicate: false });
  db.prisma.wasteDocument.create.mockResolvedValue({ id: "d1" });
});

describe("team upload", () => {
  it("refuses another organisation's project", async () => {
    const res = await POST(new NextRequest("http://x/api", { method: "POST", body: form({ kind: "carrier_licence", projectId: "proj-of-org-b" }) }), ctx);
    expect(res.status).toBe(404);
    expect(db.prisma.wasteDocument.create).not.toHaveBeenCalled();
  });
  it("stores an accepted document under the organisation", async () => {
    const res = await POST(new NextRequest("http://x/api", { method: "POST", body: form({ kind: "carrier_licence", title: "Haul Ltd", validUntil: "2027-03-01" }) }), ctx);
    expect(res.status).toBe(201);
    expect(db.prisma.wasteDocument.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", kind: "carrier_licence", status: "accepted" });
  });
  it("rejects an unknown kind", async () => {
    const res = await POST(new NextRequest("http://x/api", { method: "POST", body: form({ kind: "nonsense" }) }), ctx);
    expect(res.status).toBe(422);
  });
});

describe("review", () => {
  it("only changes documents inside the organisation", async () => {
    db.prisma.wasteDocument.updateMany.mockResolvedValue({ count: 0 });
    const res = await PATCH(new NextRequest("http://x/api", { method: "PATCH", body: JSON.stringify({ status: "accepted" }) }), { params: Promise.resolve({ orgId: "org-a", id: "doc-of-org-b" }) });
    expect(res.status).toBe(404);
    expect(db.prisma.wasteDocument.updateMany.mock.calls[0][0].where).toEqual({ id: "doc-of-org-b", organizationId: "org-a" });
  });
});

describe("contractor upload link", () => {
  const link = { id: "l1", organizationId: "org-a", projectId: "p1", label: "Haul Ltd", purpose: "waste_documents", createdByUserId: "u1", revokedAt: null, expiresAt: new Date(Date.now() + 86_400_000) };
  const call = (f: FormData) => UPLOAD(new NextRequest("http://x/api", { method: "POST", body: f }), { params: Promise.resolve({ token: "t".repeat(43) }) });
  it("creates a pending document, not a bill-inbox item", async () => {
    db.prisma.submissionLink.findUnique.mockResolvedValue(link);
    const res = await call(form({ name: "Sam", kind: "transfer_note", reference: "WTN-1" }));
    expect(res.status).toBe(201);
    expect(db.prisma.wasteDocument.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", projectId: "p1", status: "pending", submissionLinkId: "l1", uploaderName: "Sam", reference: "WTN-1" });
    expect(db.prisma.billInboxItem.upsert).not.toHaveBeenCalled();
  });
  it("asks for the kind of document", async () => {
    db.prisma.submissionLink.findUnique.mockResolvedValue(link);
    const res = await call(form({ name: "Sam" }));
    expect(res.status).toBe(422);
    expect(store.storeEvidenceFile).not.toHaveBeenCalled();
  });
});
