// @vitest-environment node
/**
 * Subcontractor upload links: issued only for the organisation's own project, stored as a hash,
 * dead once revoked or expired, withdrawn only inside the organisation, and the public upload
 * accepts only real PDFs and photos and files them under the link's organisation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    project: { findFirst: vi.fn(), findMany: vi.fn() },
    submissionLink: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findMany: vi.fn() },
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
  ROLE_GROUPS: { editor: ["admin"], projectManagers: ["project_manager"] },
}));
vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/security/org-refs", () => ({
  orgRefsError: vi.fn(async (_org: string, refs: { projectId?: string | null }) =>
    refs.projectId === "proj-of-org-b" ? new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 }) : null),
}));

import { POST } from "@/app/api/orgs/[orgId]/submission-links/route";
import { DELETE } from "@/app/api/orgs/[orgId]/submission-links/[id]/route";
import { POST as UPLOAD } from "@/app/api/public/submit/[token]/route";
import { looksLike, resolveSubmissionToken } from "@/lib/evidence/submission-link";
import { hashToken } from "@/lib/management-systems/auditor-access";

const ctx = { params: Promise.resolve({ orgId: "org-a" }) };
const post = (body: unknown) => new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(body) });
const TOKEN = "t".repeat(43);
const liveLink = { id: "l1", organizationId: "org-a", projectId: "p1", label: "Acme", createdByUserId: "u1", revokedAt: null, expiresAt: new Date(Date.now() + 86_400_000) };

function upload(parts: { name?: string; files: { name: string; type: string; bytes: Uint8Array }[] }) {
  const form = new FormData();
  if (parts.name) form.append("name", parts.name);
  for (const f of parts.files) form.append("file", new File([f.bytes as BlobPart], f.name, { type: f.type }));
  return new NextRequest("http://x/api", { method: "POST", body: form });
}
const uctx = { params: Promise.resolve({ token: TOKEN }) };
const pdf = new TextEncoder().encode("%PDF-1.7 hello");

beforeEach(() => {
  vi.clearAllMocks();
  session.requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "admin" } });
  store.storeEvidenceFile.mockResolvedValue({ id: "ev1", duplicate: false });
});

describe("issuing links", () => {
  it("refuses a project from another organisation and creates nothing", async () => {
    const res = await POST(post({ label: "Acme", projectId: "proj-of-org-b", days: 30 }), ctx);
    expect(res.status).toBe(404);
    expect(db.prisma.submissionLink.create).not.toHaveBeenCalled();
  });

  it("stores only the hash of the token it returns and caps the lifetime", async () => {
    db.prisma.submissionLink.create.mockResolvedValue({ id: "l1", expiresAt: new Date() });
    expect((await POST(post({ label: "Acme", days: 181 }), ctx)).status).toBe(422);
    const res = await POST(post({ label: "Acme", days: 30 }), ctx);
    expect(res.status).toBe(201);
    const token = ((await res.json()) as { url: string }).url.split("/submit/")[1];
    const data = db.prisma.submissionLink.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(data)).not.toContain(token);
    expect(data.organizationId).toBe("org-a");
  });

  it("withdraws only inside the organisation", async () => {
    db.prisma.submissionLink.updateMany.mockResolvedValue({ count: 0 });
    const res = await DELETE(new NextRequest("http://x/api", { method: "DELETE" }), { params: Promise.resolve({ orgId: "org-a", id: "link-of-org-b" }) });
    expect(res.status).toBe(404);
    expect(db.prisma.submissionLink.updateMany.mock.calls[0][0].where).toMatchObject({ id: "link-of-org-b", organizationId: "org-a" });
  });
});

describe("opening a link", () => {
  it("is dead when unknown, revoked or expired", async () => {
    db.prisma.submissionLink.findUnique.mockResolvedValue(null);
    expect(await resolveSubmissionToken(TOKEN)).toBeNull();
    db.prisma.submissionLink.findUnique.mockResolvedValue({ ...liveLink, revokedAt: new Date() });
    expect(await resolveSubmissionToken(TOKEN)).toBeNull();
    db.prisma.submissionLink.findUnique.mockResolvedValue({ ...liveLink, expiresAt: new Date(Date.now() - 1000) });
    expect(await resolveSubmissionToken(TOKEN)).toBeNull();
    expect(await resolveSubmissionToken("short")).toBeNull();
  });
});

describe("public upload", () => {
  it("answers 404 for a dead link and stores nothing", async () => {
    db.prisma.submissionLink.findUnique.mockResolvedValue(null);
    const res = await UPLOAD(upload({ name: "Sam", files: [{ name: "a.pdf", type: "application/pdf", bytes: pdf }] }), uctx);
    expect(res.status).toBe(404);
    expect(store.storeEvidenceFile).not.toHaveBeenCalled();
  });

  it("files a PDF under the link's organisation and project", async () => {
    db.prisma.submissionLink.findUnique.mockResolvedValue(liveLink);
    const res = await UPLOAD(upload({ name: "Sam", files: [{ name: "inv.pdf", type: "application/pdf", bytes: pdf }] }), uctx);
    expect(res.status).toBe(201);
    expect(store.storeEvidenceFile.mock.calls[0][0]).toBe("org-a");
    const create = db.prisma.billInboxItem.upsert.mock.calls[0][0].create;
    expect(create).toMatchObject({ organizationId: "org-a", projectId: "p1", submissionLinkId: "l1", uploaderName: "Sam" });
  });

  it("rejects a renamed executable, a disallowed type and a missing name", async () => {
    db.prisma.submissionLink.findUnique.mockResolvedValue(liveLink);
    const exe = new TextEncoder().encode("MZ\x90\x00");
    const bad = await UPLOAD(upload({ name: "Sam", files: [{ name: "x.pdf", type: "application/pdf", bytes: exe }, { name: "x.exe", type: "application/x-msdownload", bytes: exe }] }), uctx);
    expect(bad.status).toBe(422);
    expect(store.storeEvidenceFile).not.toHaveBeenCalled();
    const noName = await UPLOAD(upload({ files: [{ name: "a.pdf", type: "application/pdf", bytes: pdf }] }), uctx);
    expect(noName.status).toBe(422);
  });

  it("checks file signatures", () => {
    expect(looksLike("application/pdf", Buffer.from("%PDF-1.4"))).toBe(true);
    expect(looksLike("application/pdf", Buffer.from("<html>"))).toBe(false);
    expect(looksLike("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(true);
    expect(looksLike("image/jpeg", Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);
  });
});
