// @vitest-environment node
/** Presigned uploads: evidence keys only, for roles that may upload evidence, and only into the org named in the key. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  requireSession: vi.fn(),
  membership: { findUnique: vi.fn() },
  presignUpload: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  requireSession: h.requireSession,
  ROLE_GROUPS: { editor: ["admin", "sustainability_director", "sustainability_manager", "editor"] },
}));
vi.mock("@/lib/db", () => ({ prisma: { organizationMembership: h.membership } }));
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  presignUpload: h.presignUpload,
}));

import { POST } from "@/app/api/uploads/presign/route";

const body = (filename: string) =>
  new NextRequest("http://x/api/uploads/presign", {
    method: "POST",
    body: JSON.stringify({ filename, contentType: "application/pdf", byteSize: 1024, checksum: "a".repeat(64) }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSession.mockResolvedValue({ user: { id: "u1" } });
  h.presignUpload.mockResolvedValue("https://upload.test/signed");
  h.membership.findUnique.mockResolvedValue({ role: "editor" });
});

describe("POST /api/uploads/presign", () => {
  it.each([
    "org/org-a/imports/imp-1/source.csv",
    "org/org-a/reports/r1/report.pdf",
    "org/org-a/branding/logo.png",
  ])("refuses %s, which the server writes itself", async (key) => {
    const res = await POST(body(key));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_KEY");
    expect(h.presignUpload).not.toHaveBeenCalled();
  });

  it("refuses a traversal key", async () => {
    const res = await POST(body("org/org-a/evidence/../../x/y"));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("INVALID_STORAGE_KEY");
    expect(h.presignUpload).not.toHaveBeenCalled();
  });

  it("refuses a viewer and a non-member", async () => {
    h.membership.findUnique.mockResolvedValue({ role: "viewer" });
    let res = await POST(body("org/org-a/evidence/ev1/ticket.pdf"));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");

    h.membership.findUnique.mockResolvedValue(null);
    res = await POST(body("org/org-a/evidence/ev1/ticket.pdf"));
    expect(res.status).toBe(403);
    expect(h.presignUpload).not.toHaveBeenCalled();
  });

  it.each(["editor", "field_worker"])("issues a one-hour evidence URL to %s", async (role) => {
    h.membership.findUnique.mockResolvedValue({ role });
    const res = await POST(body("org/org-a/evidence/ev1/ticket.pdf"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ url: "https://upload.test/signed", key: "org/org-a/evidence/ev1/ticket.pdf" });
    expect(h.presignUpload).toHaveBeenCalledWith("org/org-a/evidence/ev1/ticket.pdf", "application/pdf");
    expect(Math.abs(Date.parse(json.expiresAt) - Date.now() - 3_600_000)).toBeLessThan(5_000);
  });
});
