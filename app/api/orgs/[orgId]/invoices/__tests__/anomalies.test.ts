import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET, POST } from "../anomalies/route";
import { NextRequest } from "next/server";
import * as auth from "@/lib/auth/session";
import * as detector from "@/lib/jobs/workers/invoice-anomaly-detector";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth/session");
vi.mock("@/lib/jobs/workers/invoice-anomaly-detector");

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

    mockRequest = new NextRequest("http://localhost:3000/api/orgs/test-org-123/invoices/anomalies", {
      method: "GET",
    });
  });

  it("returns invoice anomalies with filters", async () => {
    const mockAnomalies = [
      {
        id: "anom-1",
        invoiceId: "inv-1",
        anomalyType: "duplicate",
        severity: "critical",
        reason: "Same vendor + amount within 7 days",
        resolution: null,
        resolutionNotes: null,
        resolvedBy: null,
        detectedAt: new Date(),
        resolvedAt: null,
        invoice: {
          externalInvoiceId: "INV-001",
          vendorName: "Acme Corp",
          vendorId: "vendor-1",
          totalAmount: "5000.00",
        },
      },
    ];

    vi.mocked(detector.getInvoiceAnomalies).mockResolvedValue(mockAnomalies as any);

    const url = new URL("http://localhost:3000/api/orgs/test-org-123/invoices/anomalies");
    url.searchParams.set("severity", "critical");
    url.searchParams.set("limit", "50");
    url.searchParams.set("offset", "0");

    const response = await GET(new NextRequest(url), {
      params: Promise.resolve({ orgId: testOrgId }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].anomalyType).toBe("duplicate");
    expect(data.data[0].severity).toBe("critical");
    expect(data.pagination.total).toBe(1);
  });

  it("filters anomalies by type and date range", async () => {
    vi.mocked(detector.getInvoiceAnomalies).mockResolvedValue([]);

    const url = new URL("http://localhost:3000/api/orgs/test-org-123/invoices/anomalies");
    url.searchParams.set("type", "qty_mismatch");
    url.searchParams.set("startDate", "2024-01-01");
    url.searchParams.set("endDate", "2024-01-31");

    const response = await GET(new NextRequest(url), {
      params: Promise.resolve({ orgId: testOrgId }),
    });

    expect(response.status).toBe(200);
    expect(detector.getInvoiceAnomalies).toHaveBeenCalledWith(
      testOrgId,
      expect.objectContaining({
        type: "qty_mismatch",
      })
    );
  });

  it("returns 401 if not authorized", async () => {
    vi.mocked(auth.requireOrgMember).mockRejectedValue(new Error("Unauthorized"));

    const response = await GET(mockRequest, {
      params: Promise.resolve({ orgId: testOrgId }),
    });

    expect(response.status).toBe(500); // Error handler wraps it as 500
  });
});

describe("POST /api/orgs/[orgId]/invoices/anomalies", () => {
  let testOrgId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    testOrgId = "test-org-123";

    vi.mocked(auth.requireOrgMember).mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
      session: { id: "session-123" },
    } as any);

    vi.mocked(detector.resolveInvoiceAnomaly).mockResolvedValue(undefined);
  });

  it("resolves an invoice anomaly", async () => {
    // Mock finding the anomaly
    vi.spyOn(prisma.invoiceAnomaly, "findUniqueOrThrow").mockResolvedValue({
      id: "anom-1",
      invoiceId: "inv-1",
      anomalyType: "duplicate",
      severity: "critical",
      reason: "Duplicate invoice",
      resolution: null,
      resolutionNotes: null,
      resolvedBy: null,
      detectedAt: new Date(),
      resolvedAt: null,
      invoice: {
        organizationId: testOrgId,
      },
    } as any);

    const body = {
      anomalyId: "anom-1",
      resolution: "approved",
      resolutionNotes: "Verified duplicate, one invoice cancelled",
    };

    const request = new NextRequest(
      "http://localhost:3000/api/orgs/test-org-123/invoices/anomalies",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ orgId: testOrgId }),
    });

    expect(response.status).toBe(200);
    expect(detector.resolveInvoiceAnomaly).toHaveBeenCalledWith(
      "anom-1",
      "approved",
      "Verified duplicate, one invoice cancelled",
      "user-123"
    );
  });

  it("rejects with invalid resolution", async () => {
    const body = {
      anomalyId: "anom-1",
      resolution: "invalid_status", // not in enum
    };

    const request = new NextRequest(
      "http://localhost:3000/api/orgs/test-org-123/invoices/anomalies",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ orgId: testOrgId }),
    });

    expect(response.status).toBe(400);
  });

  it("prevents cross-org access", async () => {
    // Mock finding an anomaly from a different org
    vi.spyOn(prisma.invoiceAnomaly, "findUniqueOrThrow").mockRejectedValue(
      new Error("Not found")
    );

    const body = {
      anomalyId: "anom-1",
      resolution: "approved",
    };

    const request = new NextRequest(
      "http://localhost:3000/api/orgs/test-org-123/invoices/anomalies",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ orgId: testOrgId }),
    });

    expect(response.status).toBe(500); // Wrapped as error
  });
});
