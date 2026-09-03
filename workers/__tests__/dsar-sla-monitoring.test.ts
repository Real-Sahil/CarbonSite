/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/jobs/queues/index", () => ({
  enqueueNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/db";
import { processDsarSlaMonitoring } from "../dsar-sla-monitoring";

describe("processDsarSlaMonitoring", () => {
  const mockOrg = { id: "org-123", name: "Test Org" };
  const mockUser = { id: "user-123", email: "user@test.com" };
  const mockRequestedBy = { id: "admin-123", email: "admin@test.com" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle when no DSAR requests are at risk", async () => {
    vi.spyOn(prisma.dsarRequest, "findMany").mockResolvedValueOnce([]);

    await processDsarSlaMonitoring();

    expect(prisma.dsarRequest.findMany).toHaveBeenCalled();
  });

  it("should identify DSAR requests approaching due date", async () => {
    const now = new Date();
    const dueDateInWindow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const atRiskRequest = {
      id: "dsar-123",
      userId: mockUser.id,
      organizationId: mockOrg.id,
      type: "export" as const,
      status: "pending" as const,
      requestedAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      dueBy: dueDateInWindow,
      completedAt: null,
      resultStorageKey: null,
      requestedByUserId: mockRequestedBy.id,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: mockUser,
      organization: mockOrg,
      requestedByUser: mockRequestedBy,
    };

    vi.spyOn(prisma.dsarRequest, "findMany")
      .mockResolvedValueOnce([atRiskRequest as any])
      .mockResolvedValueOnce([]); // No overdue requests

    vi.spyOn(prisma.organizationMembership, "findMany").mockResolvedValueOnce([
      {
        id: "member-123",
        organizationId: mockOrg.id,
        userId: mockRequestedBy.id,
        role: "admin" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockRequestedBy,
      } as any,
    ]);

    await processDsarSlaMonitoring();

    // Verify the function checked for at-risk requests
    expect(prisma.dsarRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "pending",
        }),
      }),
    );
  });

  it("should skip platform-level DSAR requests (no organization)", async () => {
    const now = new Date();
    const dueDateInWindow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const platformDsar = {
      id: "dsar-platform",
      userId: mockUser.id,
      organizationId: null,
      type: "export" as const,
      status: "pending" as const,
      requestedAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      dueBy: dueDateInWindow,
      completedAt: null,
      resultStorageKey: null,
      requestedByUserId: mockRequestedBy.id,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: mockUser,
      organization: null,
      requestedByUser: mockRequestedBy,
    };

    vi.spyOn(prisma.dsarRequest, "findMany")
      .mockResolvedValueOnce([platformDsar as any])
      .mockResolvedValueOnce([]); // No overdue

    await processDsarSlaMonitoring();

    // Should not attempt to find admins for platform-level request
    expect(prisma.organizationMembership.findMany).not.toHaveBeenCalled();
  });
});
