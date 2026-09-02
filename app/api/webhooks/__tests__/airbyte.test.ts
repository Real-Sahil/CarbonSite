import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    airbyteSyncConnection: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  securityLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/jobs/queues", () => ({
  enqueueAirbyteSyncCompletion: vi.fn().mockResolvedValue({}),
  enqueueNotification: vi.fn().mockResolvedValue({}),
}));

import { POST } from "@/app/api/webhooks/airbyte/route";
import { prisma } from "@/lib/db";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/webhooks/airbyte", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockConnection = {
  id: "conn-1",
  organizationId: "org-1",
  sourceSystem: "xero",
  enabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/webhooks/airbyte", () => {
  it("returns 400 for invalid payload", async () => {
    const req = makeRequest({ type: "invalid.type" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_PAYLOAD");
  });

  it("returns 404 when connection not found", async () => {
    vi.mocked(prisma.airbyteSyncConnection.findFirst).mockResolvedValue(null);
    const req = makeRequest({
      type: "connection.sync_success",
      connectionId: "unknown-conn",
      syncRunId: "run-1",
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe("UNKNOWN_CONNECTION");
  });

  it("returns 400 when connection is disabled", async () => {
    vi.mocked(prisma.airbyteSyncConnection.findFirst).mockResolvedValue({
      ...mockConnection,
      enabled: false,
    } as any);
    const req = makeRequest({
      type: "connection.sync_success",
      connectionId: "conn-1",
      syncRunId: "run-1",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("DISABLED_CONNECTION");
  });

  it("queues sync job on sync_success and returns 202", async () => {
    vi.mocked(prisma.airbyteSyncConnection.findFirst).mockResolvedValue(mockConnection as any);
    const { enqueueAirbyteSyncCompletion } = await import("@/lib/jobs/queues");
    const req = makeRequest({
      type: "connection.sync_success",
      connectionId: "conn-1",
      syncRunId: "run-42",
      recordsEmitted: 100,
    });
    const res = await POST(req);
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(json.jobQueued).toBe(true);
    expect(enqueueAirbyteSyncCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: "conn-1", syncRunId: "run-42" }),
    );
  });

  it("acknowledges sync_failed and returns 200", async () => {
    vi.mocked(prisma.airbyteSyncConnection.findFirst).mockResolvedValue(mockConnection as any);
    const req = makeRequest({
      type: "connection.sync_failed",
      connectionId: "conn-1",
      syncRunId: "run-43",
      errorMessage: "timeout",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("failed");
    expect(prisma.airbyteSyncConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conn-1" },
        data: expect.objectContaining({ lastSyncStatus: "failed" }),
      }),
    );
  });
});
