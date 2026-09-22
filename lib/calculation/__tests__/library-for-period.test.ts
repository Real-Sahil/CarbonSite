import { describe, expect, test } from "vitest";
import { chooseFactorLibrary } from "../library-for-period";

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
