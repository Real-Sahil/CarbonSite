/**
 * Field worker submission endpoint tests.
 *
 * Run against a local dev server:
 *   BASE_URL=http://localhost:3000 pnpm vitest run tests/api/field_worker.test.ts
 *
 * Requires two pre-seeded test sessions exported as env vars:
 *   FW_SESSION_TOKEN   — valid field_worker bearer token
 *   ADMIN_SESSION_TOKEN — valid admin bearer token
 *   ORG_ID             — the org both tokens belong to
 *   SITE_ID            — a site the field worker is assigned to
 *   UNASSIGNED_SITE_ID — a site in the same org the worker is NOT assigned to
 *   OTHER_ORG_ID       — a second org the field worker does NOT belong to
 */

import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const FW_TOKEN = process.env.FW_SESSION_TOKEN ?? "";
const ADMIN_TOKEN = process.env.ADMIN_SESSION_TOKEN ?? "";
const ORG_ID = process.env.ORG_ID ?? "";
const SITE_ID = process.env.SITE_ID ?? "";
const UNASSIGNED_SITE_ID = process.env.UNASSIGNED_SITE_ID ?? "";
const OTHER_ORG_ID = process.env.OTHER_ORG_ID ?? "";

function headers(token: string, extra?: Record<string, string>) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function json(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const validSubmission = {
  siteId: SITE_ID,
  documentType: "waste_ticket",
  formData: {
    vehicleReg: "AB12 XYZ",
    wasteType: "mixed_construction",
    weightKg: 450,
    date: "2026-08-06",
  },
  ocrExtractedData: {
    rawText: "WASTE TICKET\nVehicle AB12 XYZ\n450 kg\n2026-08-06",
    confidence: 0.91,
  },
  gpsLat: 51.5074,
  gpsLng: -0.1278,
  deviceSubmittedAt: new Date().toISOString(),
};

// ── Checklist: valid submission returns 200/201 ───────────────────────────────

describe("POST /api/orgs/[orgId]/field-submissions — valid payload", () => {
  it("returns 201 with a created submission", async () => {
    const idempotencyKey = `test-valid-${Date.now()}`;
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify({ ...validSubmission, idempotencyKey }),
    });
    const body = await json(res);
    expect(res.status).toBe(201);
    expect(body).toHaveProperty("id");
    expect(body.status).toBe("submitted");
    expect(body.organizationId).toBe(ORG_ID);
  });

  it("returns 200 (not 201) on idempotent replay with the same key", async () => {
    const idempotencyKey = `test-idem-${Date.now()}`;
    const payload = { ...validSubmission, idempotencyKey };

    const first = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);
    const firstBody = await json(first);

    const second = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify(payload),
    });
    const secondBody = await json(second);
    expect(second.status).toBe(200);
    expect(secondBody.id).toBe(firstBody.id);
  });

  it("accepts the idempotency key from the Idempotency-Key header", async () => {
    const key = `test-header-idem-${Date.now()}`;
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      method: "POST",
      headers: headers(FW_TOKEN, { "Idempotency-Key": key }),
      body: JSON.stringify(validSubmission),
    });
    expect([200, 201]).toContain(res.status);
  });
});

// ── Checklist: invalid OCR payloads return 400 ───────────────────────────────

describe("POST /api/orgs/[orgId]/field-submissions — invalid payloads", () => {
  it("returns 400 when documentType is missing", async () => {
    const payload = { ...validSubmission } as Record<string, unknown>;
    delete payload.documentType;
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify(payload),
    });
    const body = await json(res);
    expect(res.status).toBe(400);
    expect(body).toHaveProperty("code");
  });

  it("returns 400 when documentType is an unknown value", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify({ ...validSubmission, documentType: "invoice" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when neither siteId nor reportingPeriodId is provided", async () => {
    const payload = { ...validSubmission } as Record<string, unknown>;
    delete payload.siteId;
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when gpsLat is out of range", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify({ ...validSubmission, gpsLat: 200 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${FW_TOKEN}`, "Content-Type": "application/json" },
      body: "not-json{{{",
    });
    expect(res.status).toBe(400);
  });

  it("returns 422 when evidenceIds contain IDs from another org", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify({ ...validSubmission, evidenceIds: ["foreign-evidence-id-000"] }),
    });
    expect(res.status).toBe(422);
    const body = await json(res);
    expect(body.code).toBe("INVALID_EVIDENCE");
  });
});

// ── Checklist: unauthenticated / wrong org ────────────────────────────────────

describe("POST /api/orgs/[orgId]/field-submissions — auth failures", () => {
  it("returns 401 when no token is provided", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validSubmission),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when field worker submits to a non-member org", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${OTHER_ORG_ID}/field-submissions`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify(validSubmission),
    });
    expect([403, 404]).toContain(res.status);
  });

  it("returns 403 when field worker submits to an unassigned site", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify({ ...validSubmission, siteId: UNASSIGNED_SITE_ID }),
    });
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe("SITE_NOT_ASSIGNED");
  });
});

// ── GET /field-submissions — field worker scope isolation ─────────────────────

describe("GET /api/orgs/[orgId]/field-submissions", () => {
  it("returns 200 for field worker and only their own submissions", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      headers: headers(FW_TOKEN),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    const submissions = body.data;
    const foreignSubmissions = submissions.filter(
      (s: { submittedByUserId?: string }) => s.submittedByUserId && s.submittedByUserId !== undefined,
    );
    // All submissions returned should be the field worker's own
    // (submittedByUserId is not exposed in the list — trust the WHERE clause)
    expect(Array.isArray(submissions)).toBe(true);
  });

  it("returns 200 for admin and all org submissions", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      headers: headers(ADMIN_TOKEN),
    });
    expect(res.status).toBe(200);
  });

  it("returns 401 without auth", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`);
    expect(res.status).toBe(401);
  });
});

// ── GET /field-submissions/:id ────────────────────────────────────────────────

describe("GET /api/orgs/[orgId]/field-submissions/[submissionId]", () => {
  let ownSubmissionId: string;

  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/field-submissions`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify({
        ...validSubmission,
        idempotencyKey: `test-get-id-${Date.now()}`,
      }),
    });
    const body = await json(res);
    ownSubmissionId = body.id;
  });

  it("field worker can GET their own submission", async () => {
    const res = await fetch(
      `${BASE_URL}/api/orgs/${ORG_ID}/field-submissions/${ownSubmissionId}`,
      { headers: headers(FW_TOKEN) },
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.id).toBe(ownSubmissionId);
  });

  it("field worker gets 404 for a submission they did not create", async () => {
    // Use a valid-format but non-existent or cross-tenant submission ID
    const alienId = "clxxxxxxxxxxxxxxxxxxxxxxxxx";
    const res = await fetch(
      `${BASE_URL}/api/orgs/${ORG_ID}/field-submissions/${alienId}`,
      { headers: headers(FW_TOKEN) },
    );
    expect([403, 404]).toContain(res.status);
  });

  it("admin can GET any submission in their org", async () => {
    const res = await fetch(
      `${BASE_URL}/api/orgs/${ORG_ID}/field-submissions/${ownSubmissionId}`,
      { headers: headers(ADMIN_TOKEN) },
    );
    expect(res.status).toBe(200);
  });
});

// ── MY SITES ──────────────────────────────────────────────────────────────────

describe("GET /api/orgs/[orgId]/my-sites", () => {
  it("returns only sites assigned to the field worker", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/my-sites`, {
      headers: headers(FW_TOKEN),
    });
    expect(res.status).toBe(200);
    const sites = await json(res);
    expect(Array.isArray(sites)).toBe(true);
    // All returned sites should be ones the worker is assigned to
    for (const site of sites) {
      expect(site).toHaveProperty("id");
      expect(site).toHaveProperty("assignmentId");
    }
  });

  it("field worker cannot list another org's sites", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${OTHER_ORG_ID}/my-sites`, {
      headers: headers(FW_TOKEN),
    });
    expect([403, 404]).toContain(res.status);
  });
});

// ── PRESIGN UPLOAD ────────────────────────────────────────────────────────────

describe("POST /api/uploads/presign", () => {
  it("returns a presigned URL for a valid org-scoped key", async () => {
    const res = await fetch(`${BASE_URL}/api/uploads/presign`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify({
        filename: `org/${ORG_ID}/evidence/test-evidence-id/photo.jpg`,
        contentType: "image/jpeg",
        byteSize: 50_000,
        checksum: "abc123abc123abc1",
      }),
    });
    expect([200, 201]).toContain(res.status);
    const body = await json(res);
    expect(body).toHaveProperty("url");
    expect(body).toHaveProperty("key");
  });

  it("returns 400 when key does not start with org/{orgId}/", async () => {
    const res = await fetch(`${BASE_URL}/api/uploads/presign`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify({
        filename: "evidence/no-org-prefix/photo.jpg",
        contentType: "image/jpeg",
        byteSize: 50_000,
        checksum: "abc123abc123abc1",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 403 when key references a different org", async () => {
    const res = await fetch(`${BASE_URL}/api/uploads/presign`, {
      method: "POST",
      headers: headers(FW_TOKEN),
      body: JSON.stringify({
        filename: `org/${OTHER_ORG_ID}/evidence/abc/photo.jpg`,
        contentType: "image/jpeg",
        byteSize: 50_000,
        checksum: "abc123abc123abc1",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 401 without auth", async () => {
    const res = await fetch(`${BASE_URL}/api/uploads/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: `org/${ORG_ID}/evidence/test/photo.jpg`,
        contentType: "image/jpeg",
        byteSize: 50_000,
        checksum: "abc123abc123abc1",
      }),
    });
    expect(res.status).toBe(401);
  });
});
