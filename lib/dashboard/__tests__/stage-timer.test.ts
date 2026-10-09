import { beforeEach, describe, expect, it, vi } from "vitest";

const warn = vi.fn();
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ warn }) }));

describe("stageTimer", () => {
  beforeEach(() => warn.mockReset());

  it("stays quiet for a fast load and returns the total", async () => {
    const { stageTimer } = await import("../stage-timer");
    const t = stageTimer("dashboard", 10_000);
    t.mark("org");
    expect(t.done({ orgId: "o1" })).toBeGreaterThanOrEqual(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs the stages, with only the organisation id, when the load is slow", async () => {
    const { stageTimer } = await import("../stage-timer");
    const t = stageTimer("dashboard", 0);
    t.mark("org");
    t.mark("aggregates");
    t.done({ orgId: "o1" });
    expect(warn).toHaveBeenCalledTimes(1);
    const [message, context] = warn.mock.calls[0];
    expect(message).toBe("dashboard was slow");
    expect(Object.keys(context).sort()).toEqual(["orgId", "stages", "totalMs"]);
    expect(Object.keys(context.stages)).toEqual(["org", "aggregates"]);
  });
});
