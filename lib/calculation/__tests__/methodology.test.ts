// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { METHODOLOGY_CHANGELOG, outdatedMethodology } from "../methodology";

describe("methodology versioning", () => {
  it("lists the seeded methodology as the newest changelog entry", () => {
    const seed = readFileSync("prisma/seed.ts", "utf8");
    expect(seed).toContain(`"${METHODOLOGY_CHANGELOG[0].name}"`);
  });

  it("flags only each period's latest snapshot, and only when it used an older version", () => {
    const out = outdatedMethodology(
      [
        { reportingPeriodId: "p1", version: 3, periodLabel: "FY25", methodology: "ghg-protocol-v2025-01" },
        { reportingPeriodId: "p1", version: 2, periodLabel: "FY25", methodology: "ghg-protocol-v2024-01" },
        { reportingPeriodId: "p2", version: 1, periodLabel: "FY26", methodology: "ghg-protocol-v2026-01" },
      ],
      "ghg-protocol-v2026-01",
    );
    expect(out).toEqual([
      expect.objectContaining({ period: "FY25", version: 3, used: "ghg-protocol-v2025-01", current: "ghg-protocol-v2026-01" }),
    ]);
    expect(out[0].changes.length).toBeGreaterThan(0);
    expect(outdatedMethodology([], null)).toEqual([]);
  });
});
