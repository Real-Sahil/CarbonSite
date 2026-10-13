import { describe, expect, it, vi } from "vitest";
import { runPat, type PatScenario } from "../pat-runner";

const scenarios: PatScenario[] = [
  { id: "R01", receipt: { n: 1 } },
  { id: "R06", receipt: { n: 6 }, skip: true },
  { id: "C01", receipt: { n: 2 }, expectRefused: true },
  { id: "H02", receipt: { n: 3 }, expectRefused: true },
];

describe("runPat", () => {
  it("never sends a skipped scenario and passes 2xx / expected refusals", async () => {
    const send = vi.fn(async (r: unknown) => ({ status: (r as { n: number }).n === 1 ? 201 : 400 }));
    const out = await runPat(scenarios, send);
    expect(send).toHaveBeenCalledTimes(3);
    expect(out).toEqual([
      { id: "R01", status: 201, passed: true, skipped: false },
      { id: "R06", status: null, passed: false, skipped: true },
      { id: "C01", status: 400, passed: true, skipped: false },
      { id: "H02", status: 400, passed: true, skipped: false },
    ]);
  });

  it("fails a normal scenario on non-2xx and a refusal scenario that was accepted", async () => {
    const out = await runPat(scenarios, async (r) => ({ status: (r as { n: number }).n === 1 ? 422 : 201 }));
    expect(out.filter((o) => !o.skipped).map((o) => o.passed)).toEqual([false, false, false]);
  });

  it("treats a thrown send (including a 5xx on a refusal scenario) as failed", async () => {
    const out = await runPat([scenarios[0], scenarios[2]], async (r) => {
      if ((r as { n: number }).n === 1) throw new Error("network");
      return { status: 503 };
    });
    expect(out).toEqual([
      { id: "R01", status: 0, passed: false, skipped: false },
      { id: "C01", status: 503, passed: false, skipped: false },
    ]);
  });
});
