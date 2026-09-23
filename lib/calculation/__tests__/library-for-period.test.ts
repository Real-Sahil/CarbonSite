import { describe, expect, test } from "vitest";
import { chooseFactorLibrary, currentFactorLibraries, supersedingLibrary } from "../library-for-period";

const libs = [
  { id: "epa25", name: "EPA", version: "2025.1" },
  { id: "d25", name: "DEFRA", version: "2025.1" },
  { id: "d26", name: "DEFRA", version: "2026.1" },
];

describe("chooseFactorLibrary", () => {
  test("uses the DEFRA set for the year the period ends in", () => {
    expect(chooseFactorLibrary(libs, new Date("2025-12-31"))?.id).toBe("d25");
    expect(chooseFactorLibrary(libs, new Date("2026-03-31"))?.id).toBe("d26");
  });

  test("uses the newest earlier DEFRA set when that year is not published yet", () => {
    expect(chooseFactorLibrary(libs, new Date("2027-08-07"))?.id).toBe("d26");
  });

  test("never picks the US EPA library for a UK period while a DEFRA set exists", () => {
    expect(chooseFactorLibrary([libs[0], libs[1]], new Date("2024-06-30"))?.id).toBe("d25");
  });

  test("falls back to any library when there is no DEFRA set", () => {
    expect(chooseFactorLibrary([libs[0]], new Date("2026-01-01"))?.id).toBe("epa25");
    expect(chooseFactorLibrary([], new Date("2026-01-01"))).toBeNull();
  });
});

describe("reloaded versions of the same year's set", () => {
  const d251 = { id: "d251", name: "DEFRA", version: "2025.1" };
  const d252 = { id: "d252", name: "DEFRA", version: "2025.2" };
  const d26 = { id: "d26", name: "DEFRA", version: "2026.1" };
  const epa = { id: "epa", name: "EPA", version: "2025.1" };

  test("a 2025 period uses the flat-file reload, not the superseded set", () => {
    expect(chooseFactorLibrary([d251, d252, d26], new Date("2025-12-31"))?.id).toBe("d252");
    expect(chooseFactorLibrary([d252, d251, d26], new Date("2025-12-31"))?.id).toBe("d252");
  });

  test("only the newest version of each year is offered, other libraries untouched", () => {
    expect(currentFactorLibraries([d26, d251, epa, d252]).map((l) => l.id)).toEqual(["d26", "epa", "d252"]);
  });

  test("a replaced version points at its replacement; current versions and other years do not", () => {
    const all = [d26, d251, epa, d252];
    expect(supersedingLibrary(d251, all)?.id).toBe("d252");
    expect(supersedingLibrary(d252, all)).toBeNull();
    expect(supersedingLibrary(d26, all)).toBeNull();
    expect(supersedingLibrary(epa, all)).toBeNull();
  });
});
