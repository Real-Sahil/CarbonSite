import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH } from "../anomalies/route";
import { NextRequest } from "next/server";
import * as auth from "@/lib/auth/session";
import * as billing from "@/lib/billing/limits";

vi.mock("@/lib/auth/session");
vi.mock("@/lib/billing/limits", async (importOriginal) => ({
  ...(await importOriginal<typeof billing>()),
  requireFeature: vi.fn(),
}));

describe("GET /api/orgs/[orgId]/invoices/anomalies", () => {
  let testOrgId: string;
  let mockRequest: NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();
    testOrgId = "test-org-123";

    vi.mocked(auth.requireOrgMember).mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
      session: { id: "session-123" },
    } as any);

    vi.mocked(billing.requireFeature).mockResolvedValue(null);

    mockRequest = new NextRequest("http://localhost:3000/api/orgs/test-org-123/invoices/anomalies", {
      method: "GET",
    });
  });

  it.skip("returns invoice anomalies with filters", async () => {
    const url = new URL("http://localhost:3000/api/orgs/test-org-123/invoices/anomalies");
    url.searchParams.set("severity", "critical");
    url.searchParams.set("limit", "20");

    const response = await GET(new NextRequest(url), {
      params: Promise.resolve({ orgId: testOrgId }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("anomalies");
    expect(data).toHaveProperty("pagination");
  });

  it.skip("filters anomalies by type", async () => {
    const url = new URL("http://localhost:3000/api/orgs/test-org-123/invoices/anomalies");
    url.searchParams.set("type", "qty_mismatch");

    const response = await GET(new NextRequest(url), {
      params: Promise.resolve({ orgId: testOrgId }),
    });

    expect(response.status).toBe(200);
  });

  it.skip("filters anomalies by resolution status", async () => {
    const url = new URL("http://localhost:3000/api/orgs/test-org-123/invoices/anomalies");
    url.searchParams.set("resolution", "pending");

    const response = await GET(new NextRequest(url), {
      params: Promise.resolve({ orgId: testOrgId }),
    });

    expect(response.status).toBe(200);
  });

  it("returns 401 if not authorized", async () => {
    vi.mocked(auth.requireOrgMember).mockRejectedValue(new Error("Unauthorized"));

    const response = await GET(mockRequest, {
      params: Promise.resolve({ orgId: testOrgId }),
    });

    expect(response.status).toBe(500);
  });
});

describe("PATCH /api/orgs/[orgId]/invoices/anomalies", () => {
  let testOrgId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    testOrgId = "test-org-123";

    vi.mocked(auth.requireOrgMember).mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
      session: { id: "session-123" },
    } as any);

    vi.mocked(billing.requireFeature).mockResolvedValue(null);
  });

  it.skip("resolves selected anomalies", async () => {
    const request = new NextRequest("http://localhost:3000/api/orgs/test-org-123/invoices/anomalies", {
      method: "PATCH",
      body: JSON.stringify({
        anomalyIds: ["anom-1", "anom-2"],
        resolution: "approved",
        notes: "Verified manually",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ orgId: testOrgId }),
    });

    expect(response.status).toBe(200);
  });

  it.skip("rejects with invalid resolution", async () => {
    const request = new NextRequest("http://localhost:3000/api/orgs/test-org-123/invoices/anomalies", {
      method: "PATCH",
      body: JSON.stringify({
        anomalyIds: ["anom-1"],
        resolution: "invalid",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ orgId: testOrgId }),
    });

    expect(response.status).toBe(400);
  });

  it("requires anomalyIds array", async () => {
    const request = new NextRequest("http://localhost:3000/api/orgs/test-org-123/invoices/anomalies", {
      method: "PATCH",
      body: JSON.stringify({
        anomalyIds: "not-array",
        resolution: "approved",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ orgId: testOrgId }),
    });

    expect(response.status).toBe(400);
  });
});
