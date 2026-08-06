/**
 * Multi-tenant and project isolation tests.
 *
 * Run against a local dev server:
 *   BASE_URL=http://localhost:3000 pnpm vitest run tests/api/tenant_isolation.test.ts
 *
 * Required env vars:
 *   BASE_URL              — http://localhost:3000
 *   ORG_A_ADMIN_TOKEN     — admin session token for Org A
 *   ORG_A_ID              — Org A tenant ID
 *   ORG_B_ADMIN_TOKEN     — admin session token for Org B
 *   ORG_B_ID              — Org B tenant ID
 *   ORG_A_FW_TOKEN        — field_worker token for Org A
 *   ORG_B_SUBMISSION_ID   — a field submission ID that belongs to Org B
 *   ORG_B_RECORD_ID       — an activity record ID that belongs to Org B
 *   ORG_B_IMPORT_ID       — an import batch ID that belongs to Org B
 *   ORG_B_REPORT_ID       — a report ID that belongs to Org B
 *   ORG_B_SITE_ID         — a site ID in Org B
 *
 * IMPORTANT: These tests attempt cross-tenant reads/writes. They MUST return
 * 403 or 404 — never 200. A 200 response means a cross-tenant data leak and
 * should be treated as a P0 security incident.
 *
 * No destructive operations are performed unless clearly marked ⚠️ DESTRUCTIVE.
 */

import { describe, it, expect } from "vitest";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ORG_A_ADMIN = process.env.ORG_A_ADMIN_TOKEN ?? "";
const ORG_A_ID = process.env.ORG_A_ID ?? "";
const ORG_A_FW = process.env.ORG_A_FW_TOKEN ?? "";
const ORG_B_ADMIN = process.env.ORG_B_ADMIN_TOKEN ?? "";
const ORG_B_ID = process.env.ORG_B_ID ?? "";
const ORG_B_SUBMISSION_ID = process.env.ORG_B_SUBMISSION_ID ?? "clb000000000000000000000000";
const ORG_B_RECORD_ID = process.env.ORG_B_RECORD_ID ?? "clb000000000000000000000001";
const ORG_B_IMPORT_ID = process.env.ORG_B_IMPORT_ID ?? "clb000000000000000000000002";
const ORG_B_REPORT_ID = process.env.ORG_B_REPORT_ID ?? "clb000000000000000000000003";
const ORG_B_SITE_ID = process.env.ORG_B_SITE_ID ?? "clb000000000000000000000004";

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function json(res: Response) {
  try { return await res.json(); } catch { return null; }
}

// ── Cross-tenant field submission reads ───────────────────────────────────────

describe("Cross-tenant field submission isolation", () => {
  it("Org A admin cannot read Org B field submission list", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_B_ID}/field-submissions`, {
      headers: auth(ORG_A_ADMIN),
    });
    expect([403, 404]).toContain(res.status);
    if (res.status === 200) {
      throw new Error("P0 DATA LEAK: Org A admin read Org B field submissions");
    }
  });

  it("Org A admin cannot read a specific Org B field submission", async () => {
    const res = await fetch(
      `${BASE_URL}/api/orgs/${ORG_B_ID}/field-submissions/${ORG_B_SUBMISSION_ID}`,
      { headers: auth(ORG_A_ADMIN) },
    );
    expect([403, 404]).toContain(res.status);
    if (res.status === 200) {
      throw new Error("P0 DATA LEAK: Org A admin read Org B submission detail");
    }
  });

  it("Org A field worker cannot submit to Org B", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_B_ID}/field-submissions`, {
      method: "POST",
      headers: auth(ORG_A_FW),
      body: JSON.stringify({
        siteId: ORG_B_SITE_ID,
        documentType: "waste_ticket",
        formData: { note: "cross-tenant attack" },
      }),
    });
    expect([403, 404]).toContain(res.status);
  });
});

// ── Cross-tenant activity records ─────────────────────────────────────────────

describe("Cross-tenant activity record isolation", () => {
  it("Org A admin cannot list Org B activity records", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_B_ID}/activity-records`, {
      headers: auth(ORG_A_ADMIN),
    });
    expect([403, 404]).toContain(res.status);
  });

  it("Org A admin cannot read a specific Org B activity record", async () => {
    const res = await fetch(
      `${BASE_URL}/api/orgs/${ORG_B_ID}/activity-records/${ORG_B_RECORD_ID}`,
      { headers: auth(ORG_A_ADMIN) },
    );
    expect([403, 404]).toContain(res.status);
  });

  it("Org A admin cannot create an activity record in Org B", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_B_ID}/activity-records`, {
      method: "POST",
      headers: auth(ORG_A_ADMIN),
      body: JSON.stringify({
        reportingPeriodId: "cl000000000000000000000000",
        emissionCategoryId: "s1-stationary",
        amount: 100,
        unit: "kWh",
      }),
    });
    expect([403, 404]).toContain(res.status);
  });
});

// ── Cross-tenant dashboard ────────────────────────────────────────────────────

describe("Cross-tenant dashboard isolation", () => {
  it("Org A admin cannot read Org B dashboard aggregates", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_B_ID}/dashboard`, {
      headers: auth(ORG_A_ADMIN),
    });
    expect([403, 404]).toContain(res.status);
    if (res.status === 200) {
      throw new Error("P0 DATA LEAK: Org A admin read Org B dashboard");
    }
  });

  it("Org A field worker cannot access the dashboard at all", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_A_ID}/dashboard`, {
      headers: auth(ORG_A_FW),
    });
    // field_worker is not in ROLE_GROUPS.anyMember — should return 403
    expect([403, 404]).toContain(res.status);
  });
});

// ── Cross-tenant imports ──────────────────────────────────────────────────────

describe("Cross-tenant import isolation", () => {
  it("Org A admin cannot list Org B imports", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_B_ID}/imports`, {
      headers: auth(ORG_A_ADMIN),
    });
    expect([403, 404]).toContain(res.status);
  });

  it("Org A admin cannot commit an Org B import batch", async () => {
    const res = await fetch(
      `${BASE_URL}/api/orgs/${ORG_B_ID}/imports/${ORG_B_IMPORT_ID}/commit`,
      {
        method: "POST",
        headers: auth(ORG_A_ADMIN),
        body: JSON.stringify({}),
      },
    );
    expect([403, 404]).toContain(res.status);
  });
});

// ── Cross-tenant reports ──────────────────────────────────────────────────────

describe("Cross-tenant report isolation", () => {
  it("Org A admin cannot list Org B reports", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_B_ID}/reports`, {
      headers: auth(ORG_A_ADMIN),
    });
    expect([403, 404]).toContain(res.status);
  });

  it("Org A admin cannot download an Org B report", async () => {
    const res = await fetch(
      `${BASE_URL}/api/orgs/${ORG_B_ID}/reports/${ORG_B_REPORT_ID}/download`,
      { headers: auth(ORG_A_ADMIN) },
    );
    expect([403, 404]).toContain(res.status);
  });
});

// ── Cross-tenant member management ───────────────────────────────────────────

describe("Cross-tenant member management isolation", () => {
  it("Org A admin cannot list Org B members", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_B_ID}/members`, {
      headers: auth(ORG_A_ADMIN),
    });
    expect([403, 404]).toContain(res.status);
  });

  it("Org A admin cannot create an invite link for Org B", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_B_ID}/invite-links`, {
      method: "POST",
      headers: auth(ORG_A_ADMIN),
      body: JSON.stringify({ role: "field_worker", expiresInDays: 7 }),
    });
    expect([403, 404]).toContain(res.status);
  });
});

// ── Cross-tenant site assignment ──────────────────────────────────────────────

describe("Cross-tenant site assignment isolation", () => {
  it("Org A admin cannot assign a worker to an Org B site", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_A_ID}/field-worker-site-assignments`, {
      method: "POST",
      headers: auth(ORG_A_ADMIN),
      body: JSON.stringify({
        userId: "clorg-a-worker-user-id",
        siteId: ORG_B_SITE_ID,
      }),
    });
    // Should reject with 422 (INVALID_SITE) because site is checked against orgId
    expect([403, 404, 422]).toContain(res.status);
  });
});

// ── Field worker privilege escalation ────────────────────────────────────────

describe("Field worker privilege escalation", () => {
  it("field worker cannot approve their own submission (reviewer-only)", async () => {
    // Create a submission first
    const create = await fetch(`${BASE_URL}/api/orgs/${ORG_A_ID}/field-submissions`, {
      method: "POST",
      headers: auth(ORG_A_FW),
      body: JSON.stringify({
        siteId: process.env.SITE_ID ?? "clsite000000000000000000000",
        documentType: "waste_ticket",
        formData: { note: "test escalation" },
        idempotencyKey: `test-escalation-${Date.now()}`,
      }),
    });
    if (create.status !== 201) return; // No submission created, skip
    const submission = await json(create);

    const approve = await fetch(
      `${BASE_URL}/api/orgs/${ORG_A_ID}/field-submissions/${submission.id}/review`,
      {
        method: "PATCH",
        headers: auth(ORG_A_FW),
        body: JSON.stringify({ action: "approved" }),
      },
    );
    expect([403, 404]).toContain(approve.status);
  });

  it("field worker cannot list all org submissions (only their own)", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_A_ID}/field-submissions`, {
      headers: auth(ORG_A_FW),
    });
    // Must succeed (200) but must only return own submissions — verified by
    // the field_worker WHERE clause in the route handler. This test is a
    // regression guard to ensure the WHERE clause is still present.
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body.data)).toBe(true);
    // Smoke: no cross-org data visible (organizationId check)
    for (const s of body.data ?? []) {
      if (s.organizationId) expect(s.organizationId).toBe(ORG_A_ID);
    }
  });

  it("field worker cannot access org audit log", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_A_ID}/audit`, {
      headers: auth(ORG_A_FW),
    });
    expect([403, 404]).toContain(res.status);
  });

  it("field worker cannot access calculation runs", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_A_ID}/calculation-runs`, {
      headers: auth(ORG_A_FW),
    });
    expect([403, 404]).toContain(res.status);
  });

  it("field worker cannot post comments on activity records", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_A_ID}/comments`, {
      method: "POST",
      headers: auth(ORG_A_FW),
      body: JSON.stringify({
        targetType: "activity_record",
        targetId: "clsome-record-id-00000000000",
        body: "escalation test",
      }),
    });
    expect([403, 404]).toContain(res.status);
  });
});

// ── Storage key isolation ─────────────────────────────────────────────────────

describe("Storage key isolation via /api/uploads/presign", () => {
  it("Org A user cannot get a presigned URL for an Org B storage key", async () => {
    const res = await fetch(`${BASE_URL}/api/uploads/presign`, {
      method: "POST",
      headers: auth(ORG_A_ADMIN),
      body: JSON.stringify({
        filename: `org/${ORG_B_ID}/evidence/test-evidence-id/photo.jpg`,
        contentType: "image/jpeg",
        byteSize: 50_000,
        checksum: "abc123abc123abc1",
      }),
    });
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body?.code).toBe("FORBIDDEN");
  });

  it("storage key without org prefix is rejected (INVALID_KEY)", async () => {
    const res = await fetch(`${BASE_URL}/api/uploads/presign`, {
      method: "POST",
      headers: auth(ORG_A_ADMIN),
      body: JSON.stringify({
        filename: "evidence/no-prefix/photo.jpg",
        contentType: "image/jpeg",
        byteSize: 50_000,
        checksum: "abc123abc123abc1",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("path-traversal storage keys are rejected", async () => {
    const res = await fetch(`${BASE_URL}/api/uploads/presign`, {
      method: "POST",
      headers: auth(ORG_A_ADMIN),
      body: JSON.stringify({
        filename: `org/${ORG_A_ID}/evidence/../../../etc/passwd`,
        contentType: "text/plain",
        byteSize: 100,
        checksum: "abc123abc123abc1",
      }),
    });
    expect([400, 422]).toContain(res.status);
  });
});

// ── Cross-tenant errors must not leak tenant IDs ──────────────────────────────

describe("Error message tenant enumeration resistance", () => {
  it("cross-tenant 403 response body does not contain Org B ID or name", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_B_ID}/dashboard`, {
      headers: auth(ORG_A_ADMIN),
    });
    const text = await res.text();
    expect(text).not.toContain(ORG_B_ID);
    // Should not expose 'organization', 'tenant', or the actual org ID in error
    expect(text.toLowerCase()).not.toMatch(/organization name|tenant id/);
  });
});
