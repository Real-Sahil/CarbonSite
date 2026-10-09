// @vitest-environment node
/** Asking a carrier: org-scoped, only for transfer notes with gaps, the list comes from the stored reading, the address is not kept. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    wasteDocument: { findFirst: vi.fn(), update: vi.fn() },
    organization: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn().mockResolvedValue(null) }));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/notifications/email", () => mail);
const session = vi.hoisted(() => ({ requireOrgMember: vi.fn(), AuthError: class AuthError extends Error {}, ROLE_GROUPS: { editor: ["admin"], projectManagers: ["project_manager"] } }));
vi.mock("@/lib/auth/session", () => session);

import { POST } from "@/app/api/orgs/[orgId]/waste/documents/[id]/ask-carrier/route";

const gappy = { id: "d1", kind: "transfer_note", title: "WTN 7", wasteRecordId: null, extracted: { reference: "WTN7", tonnes: 4 } };
const call = (body: unknown, id = "d1") => POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ orgId: "org-a", id }) });

beforeEach(() => {
  vi.clearAllMocks();
  session.requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "admin" } });
  db.prisma.wasteDocument.findFirst.mockResolvedValue(gappy);
  db.prisma.organization.findUnique.mockResolvedValue({ name: "Sisk" });
  db.prisma.user.findUnique.mockResolvedValue({ name: "Abigail", email: "abigail@example.com" });
});

describe("ask the carrier", () => {
  it("looks the document up inside the organisation only", async () => {
    db.prisma.wasteDocument.findFirst.mockResolvedValue(null);
    expect((await call({ to: "carrier@example.com" }, "other-org-doc")).status).toBe(404);
    expect(db.prisma.wasteDocument.findFirst.mock.calls[0][0].where).toEqual({ id: "other-org-doc", organizationId: "org-a" });
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("sends with the sender as reply-to and the gaps from the stored reading", async () => {
    const res = await call({ to: "carrier@example.com", note: "Thanks" });
    expect(res.status).toBe(201);
    const sent = mail.sendEmail.mock.calls[0][0];
    expect(sent.to).toBe("carrier@example.com");
    expect(sent.replyTo).toBe("abigail@example.com");
    expect(sent.text).toContain("carrier registration number");
    expect(sent.text).toContain("date of collection");
    expect(sent.text).not.toContain("weight in tonnes");
  });

  it("keeps when it was asked but not the carrier's address", async () => {
    await call({ to: "carrier@example.com" });
    const data = db.prisma.wasteDocument.update.mock.calls[0][0].data.extracted;
    expect(data.carrierAsked.at).toBeTruthy();
    expect(JSON.stringify(data)).not.toContain("carrier@example.com");
  });

  it("refuses a note with nothing missing, a recorded note, or a bad address", async () => {
    db.prisma.wasteDocument.findFirst.mockResolvedValue({ ...gappy, extracted: { reference: "W", tonnes: 1, date: "2026-10-01", ewc: "17 09 04", carrierRegistration: "CBDU1" } });
    expect((await call({ to: "carrier@example.com" })).status).toBe(422);
    db.prisma.wasteDocument.findFirst.mockResolvedValue({ ...gappy, wasteRecordId: "wr1" });
    expect((await call({ to: "carrier@example.com" })).status).toBe(409);
    db.prisma.wasteDocument.findFirst.mockResolvedValue(gappy);
    expect((await call({ to: "not-an-email" })).status).toBe(422);
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });
});
