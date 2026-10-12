// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  subcontractorCarbonSubmission: { findUnique: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));

import { hashToken } from "@/lib/management-systems/auditor-access";
import { isValidStorageKey } from "@/lib/storage";
import {
  EVIDENCE_TYPES,
  LINK_DAYS,
  MAX_EVIDENCE_BYTES,
  OPEN_STATUSES,
  evidenceKeyFor,
  issueLinkToken,
  orgSubmissionView,
  portalFormFields,
  portalSubmissionSchema,
  portalUrl,
  portalView,
  readEvidence,
  recordOpened,
  resolveSubcontractorToken,
} from "@/lib/subcontractor/portal";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("link tokens", () => {
  it("issues a 43-character URL-safe token, stores only its SHA-256, and expires in 30 days", () => {
    const now = new Date("2026-10-12T09:00:00Z");
    const { token, tokenHash, tokenExpiresAt } = issueLinkToken(now);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).not.toContain(token);
    expect(tokenExpiresAt.getTime() - now.getTime()).toBe(LINK_DAYS * DAY);
    expect(LINK_DAYS).toBe(30);
  });

  it("issues a different token each time", () => {
    expect(issueLinkToken().token).not.toBe(issueLinkToken().token);
  });

  it("builds the portal URL from the token", () => {
    const token = "b".repeat(43);
    expect(portalUrl(token)).toMatch(new RegExp(`/subcontractor/${token}$`));
  });

  it("looks a link up by its hash, refuses malformed tokens without asking the database, and treats unknown or expired links as missing", async () => {
    expect(await resolveSubcontractorToken("short")).toBeNull();
    expect(db.subcontractorCarbonSubmission.findUnique).not.toHaveBeenCalled();

    const token = "c".repeat(43);
    db.subcontractorCarbonSubmission.findUnique.mockResolvedValueOnce(null);
    expect(await resolveSubcontractorToken(token)).toBeNull();
    expect(db.subcontractorCarbonSubmission.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashToken(token) });

    db.subcontractorCarbonSubmission.findUnique.mockResolvedValueOnce({ id: "sub-a", tokenExpiresAt: new Date(Date.now() - 1) });
    expect(await resolveSubcontractorToken(token)).toBeNull();

    const open = { id: "sub-a", tokenExpiresAt: new Date(Date.now() + DAY) };
    db.subcontractorCarbonSubmission.findUnique.mockResolvedValueOnce(open);
    expect(await resolveSubcontractorToken(token)).toBe(open);
  });
});

describe("portal form", () => {
  it("accepts one scope and rejects a form with none", () => {
    expect(portalSubmissionSchema.safeParse({ submitterName: "Sam", scope2Tco2e: "4" }).success).toBe(true);

    const none = portalSubmissionSchema.safeParse({ submitterName: "Sam" });
    expect(none.success).toBe(false);
    expect(none.error?.issues[0]?.message).toBe("Enter at least one scope.");
  });

  it.each([
    ["a five-decimal figure", { scope1Tco2e: "1.23456" }],
    ["a negative figure", { scope1Tco2e: "-1" }],
    ["scientific notation", { scope1Tco2e: "1e3" }],
    ["more than nine whole digits", { scope1Tco2e: "1000000000" }],
    ["a blank name", { submitterName: "   " }],
    ["a note over 1000 characters", { submitterNote: "x".repeat(1001) }],
  ])("rejects %s", (_, override) => {
    const base = { submitterName: "Sam", scope1Tco2e: "1" };
    expect(portalSubmissionSchema.safeParse({ ...base, ...override }).success).toBe(false);
  });

  it("reads blank fields as absent, not empty strings", () => {
    const form = new FormData();
    form.append("submitterName", "  Sam  ");
    form.append("scope1Tco2e", "   ");
    form.append("submitterNote", "");
    expect(portalFormFields(form)).toEqual({
      submitterName: "Sam",
      scope1Tco2e: undefined,
      scope2Tco2e: undefined,
      scope3Tco2e: undefined,
      submitterNote: undefined,
    });
  });

  it("answers only while the request is open", () => {
    expect([...OPEN_STATUSES].sort()).toEqual(["overdue", "rejected", "requested"]);
    expect(OPEN_STATUSES).not.toContain("submitted");
    expect(OPEN_STATUSES).not.toContain("verified");
  });
});

describe("evidence", () => {
  const png = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it("accepts a file whose bytes match its declared type", async () => {
    const file = new File([png()], "scope.png", { type: "image/png" });
    const read = await readEvidence(file);
    expect(read).toMatchObject({ type: "image/png", name: "scope.png" });
  });

  it("refuses a type outside the allow-list", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    expect(await readEvidence(file)).toMatchObject({ error: expect.stringContaining("send a PDF, JPEG, PNG or WEBP") });
    expect(EVIDENCE_TYPES).not.toContain("text/plain");
  });

  it("refuses bytes that do not match the declared type", async () => {
    const file = new File(["%PDF-1.4 not a picture"], "scan.jpg", { type: "image/jpeg" });
    expect(await readEvidence(file)).toMatchObject({ error: expect.stringContaining("not a valid jpeg") });
  });

  it("refuses a file over 10 MB", async () => {
    const file = new File([new Uint8Array(MAX_EVIDENCE_BYTES + 1)], "big.pdf", { type: "application/pdf" });
    expect(await readEvidence(file)).toMatchObject({ error: expect.stringContaining("over 10 MB") });
    expect(MAX_EVIDENCE_BYTES).toBe(10 * 1024 * 1024);
  });

  it("builds a valid, time-prefixed storage key inside the organisation and submission", () => {
    const key = evidenceKeyFor("org-a", "sub-a", "scope 1 (final).pdf", 1_700_000_000_000);
    expect(key.startsWith("org/org-a/subcontractor/sub-a/")).toBe(true);
    expect(isValidStorageKey(key)).toBe(true);
    const segment = key.split("/").pop() ?? "";
    expect(segment).toMatch(/-scope 1 -final-\.pdf$/); // parentheses become hyphens, not kept
    expect(segment).not.toContain("_");
  });

  it("keeps a traversal attempt inside the segment and never produces a path separator", () => {
    const key = evidenceKeyFor("org-a", "sub-a", "../../etc/passwd", 1);
    expect(isValidStorageKey(key)).toBe(true);
    expect(key.split("/")).toHaveLength(5); // org, org id, subcontractor, submission, file
    expect(key.split("/").pop()).toMatch(/-upload-etc-passwd$/);
  });

  it("gives two uploads of the same name different keys, so a resubmission never overwrites", () => {
    const first = evidenceKeyFor("org-a", "sub-a", "scope.pdf", 1_700_000_000_000);
    const second = evidenceKeyFor("org-a", "sub-a", "scope.pdf", 1_700_000_500_000);
    expect(first).not.toBe(second);
  });
});

describe("views", () => {
  const row = {
    id: "sub-a",
    organizationId: "org-a",
    subcontractorName: "Groundworks Ltd",
    reportingPeriodLabel: "FY2026",
    dueDate: new Date("2026-11-30T00:00:00Z"),
    status: "rejected" as const,
    submittedAt: new Date("2026-10-01T10:00:00Z"),
    rejectionReason: "Scope 2 missing",
    tokenExpiresAt: new Date("2026-11-11T00:00:00Z"),
    contactEmail: "ops@groundworks.test",
    requestedByUserId: "admin-a",
    internalNote: "Chase after Friday",
    tokenHash: "f".repeat(64),
    evidenceStorageKey: "org/org-a/subcontractor/sub-a/1-scope.pdf",
    scope1Tco2e: null,
    scope2Tco2e: null,
    scope3Tco2e: null,
  };

  it("shows the subcontractor only their request, its status and the reason it was sent back", () => {
    const view = portalView(row, "Org A");
    expect(Object.keys(view).sort()).toEqual([
      "canSubmit",
      "dueDate",
      "linkExpiresAt",
      "orgName",
      "rejectionReason",
      "reportingPeriodLabel",
      "status",
      "subcontractorName",
      "submittedAt",
    ]);
    expect(view).toMatchObject({ orgName: "Org A", dueDate: "2026-11-30", canSubmit: true, rejectionReason: "Scope 2 missing" });
    expect(JSON.stringify(view)).not.toMatch(/ops@groundworks|admin-a|Chase after|tokenHash|evidence/);
  });

  it("hides a rejection reason from a request that is no longer rejected", () => {
    expect(portalView({ ...row, status: "requested" }, "Org A").rejectionReason).toBeNull();
  });

  it("strips the token hash and the evidence key from what the team's screens receive", () => {
    const view = orgSubmissionView(row);
    expect(view).not.toHaveProperty("tokenHash");
    expect(view).not.toHaveProperty("evidenceStorageKey");
    expect(view.hasEvidence).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/org\/org-a\/subcontractor|f{64}/);
    expect(orgSubmissionView({ ...row, evidenceStorageKey: null }).hasEvidence).toBe(false);
  });

  it("records the first open and leaves later opens alone", async () => {
    db.subcontractorCarbonSubmission.updateMany.mockResolvedValue({ count: 1 });
    await recordOpened("sub-a");
    expect(db.subcontractorCarbonSubmission.updateMany).toHaveBeenCalledWith({
      where: { id: "sub-a", openedAt: null },
      data: { openedAt: expect.any(Date) },
    });
  });
});
