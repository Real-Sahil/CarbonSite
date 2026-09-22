import { describe, expect, test } from "vitest";
import { describeLibrary, libraryMismatch, recommendedLibrary } from "../library-options";

const epa = { id: "epa", name: "EPA", version: "2025.1" };
const d25 = { id: "d25", name: "DEFRA", version: "2025.1" };
const d26 = { id: "d26", name: "DEFRA", version: "2026.1" };
const libs = [d26, d25, epa];

describe("factor library options", () => {
  test("recommends the DEFRA set for the period and labels it", () => {
    const rec = recommendedLibrary(libs, new Date("2027-08-07"));
    expect(rec?.id).toBe("d26");
    expect(describeLibrary(d26, rec!.id)).toBe("DEFRA 2026 (UK, recommended)");
    expect(describeLibrary(d25, rec!.id)).toBe("DEFRA 2025 (UK, for periods ending 2025)");
    expect(describeLibrary(epa, rec!.id)).toBe("US EPA 2025 (for US operations)");
  });

  test("no warning when the recommended library is chosen", () => {
    expect(libraryMismatch(d26, d26, new Date("2027-08-07"))).toBeNull();
  });

  test("warns when an older DEFRA set is chosen", () => {
    expect(libraryMismatch(d25, d26, new Date("2027-08-07"))).toMatch(/ends in 2027.*DEFRA 2026 is recommended/);
  });

  test("keeps EPA selectable but explains when it applies", () => {
    expect(libraryMismatch(epa, d26, new Date("2026-12-31"))).toMatch(/only for activity in the US/);
  });
});
