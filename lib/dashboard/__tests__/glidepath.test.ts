import { describe, expect, it } from "vitest";
import { glidepath, type GlidepathInput } from "../glidepath";

const base: GlidepathInput = {
  baselineTonnes: 1000,
  targetTonnes: 500,
  baselineEnd: new Date("2024-12-31"),
  targetEnd: new Date("2029-12-31"),
  periodStart: new Date("2026-01-01"),
  periodEnd: new Date("2026-12-31"),
  actualTonnes: 900,
  now: new Date("2027-02-01"),
};

describe("glidepath", () => {
  it("compares a complete period in full against the line", () => {
    const r = glidepath(base)!;
    expect(r.partial).toBe(false);
    expect(r.expectedTonnes).toBeCloseTo(1000 - 500 * (730 / 1826), 0);
    expect(r.status).toBe("behind");
    expect(r.gapTonnes).toBeGreaterThan(0);
  });

  it("is ahead when below the line", () => {
    expect(glidepath({ ...base, actualTonnes: 500 })!.status).toBe("ahead");
  });

  it("is on track inside the 2% band", () => {
    const expected = glidepath(base)!.expectedTonnes;
    expect(glidepath({ ...base, actualTonnes: expected * 1.01 })!.status).toBe("on_track");
  });

  it("compares a running period pro rata", () => {
    const r = glidepath({ ...base, now: new Date("2026-07-01"), actualTonnes: 400 })!;
    expect(r.partial).toBe(true);
    expect(r.expectedTonnes).toBeLessThan(glidepath(base)!.expectedTonnes);
  });

  it("returns null when the target date is not after the baseline", () => {
    expect(glidepath({ ...base, targetEnd: new Date("2024-12-31") })).toBeNull();
  });

  it("returns null without a usable baseline or actual", () => {
    expect(glidepath({ ...base, baselineTonnes: 0 })).toBeNull();
    expect(glidepath({ ...base, actualTonnes: Number.NaN })).toBeNull();
  });
});
