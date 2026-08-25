import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { processUptimeMonitoring } from "../uptime-monitoring";

describe("processUptimeMonitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully check health when service is up", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await processUptimeMonitoring();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/health"),
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("should throw error when health check returns non-200 status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 500,
      json: async () => ({ ok: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(processUptimeMonitoring()).rejects.toThrow(
      "Health check failed",
    );
  });

  it("should throw error when health check reports not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(processUptimeMonitoring()).rejects.toThrow(
      "Health check failed",
    );
  });

  it("should throw error on network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network timeout"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(processUptimeMonitoring()).rejects.toThrow("Network timeout");
  });

  it("should log warning for slow response", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Mock Date.now to control timing
    const now = Date.now;
    let timeOffset = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now() + timeOffset);

    // Set up the mock to simulate a 6-second response
    fetchMock.mockImplementation(async () => {
      timeOffset = 6000;
      return { status: 200, json: async () => ({ ok: true }) };
    });

    await processUptimeMonitoring();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[uptime-monitoring] Slow health check"),
    );

    consoleWarnSpy.mockRestore();
  });
});
