// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const libs = [
  { id: "epa", name: "EPA", version: "2025.1" },
  { id: "d25", name: "DEFRA", version: "2025.2" },
  { id: "d26", name: "DEFRA", version: "2026.1" },
  { id: "ad", name: "ADEME Base Carbone", version: "2025.04" },
];
const factor = (id: string, libId: string, cat: string, unit: string, extra: object = {}) => ({
  id, externalId: id, factorLibraryId: libId, emissionCategoryId: cat, activityType: null, geographyCountry: "GB",
  geographyRegion: null, effectiveStartDate: null, effectiveEndDate: null, inputUnit: unit, usageNotes: "", co2e: 1, ...extra,
});
const rows = [
  factor("defra-26-flight", "d26", "travel", "pkm"),
  factor("defra-25-flight", "d25", "travel", "pkm"),
  factor("defra-26-grid", "d26", "grid", "kWh"),
  factor("ademe-ship", "ad", "freight", "tonne.km", { geographyCountry: "FR" }),
];
vi.mock("@/lib/db", () => ({
  prisma: {
    factorLibrary: { findMany: async () => libs },
    emissionFactor: { findMany: async ({ where }: { where: { factorLibraryId: string } }) => rows.filter((r) => r.factorLibraryId === where.factorLibraryId) },
  },
}));
import { fallbackOrder, newFallbackState, selectFallbackFactor } from "../library-fallback";

const q = (cat: string, unit: string) => ({ emissionCategoryId: cat, factorLibraryId: "epa", activityDate: new Date("2026-05-01"), recordUnit: unit });
const run = (code: string, cat: string, unit: string, runLib = { id: "epa", name: "EPA" }, country: string | null = "US") =>
  selectFallbackFactor(runLib, code, q(cat, unit), unit, new Date("2026-12-31"), newFallbackState(), country);

describe("library fallback", () => {
  it("orders DEFRA for the period then ADEME, and only for EPA runs", () => {
    expect(fallbackOrder({ name: "EPA" }, libs, new Date("2026-12-31")).map((l) => l.id)).toEqual(["d26", "ad"]);
    expect(fallbackOrder({ name: "EPA" }, libs, new Date("2025-06-30")).map((l) => l.id)).toEqual(["d25", "ad"]);
    expect(fallbackOrder({ name: "DEFRA" }, libs, new Date("2026-12-31"))).toEqual([]);
  });

  it("prices a record from DEFRA and says so, naming the proxy country", async () => {
    const r = await run("s3-business-travel", "travel", "pkm");
    expect(r?.factor.externalId).toBe("defra-26-flight");
    expect(r?.selectionReason).toMatch(/^fallback library DEFRA 2026\.1/);
    expect(r?.warnings?.join(" ")).toMatch(/EPA has no factor.*DEFRA 2026\.1.*GB factor, a proxy for US operations/);
  });

  it("moves on to ADEME when DEFRA has nothing, and skips a factor whose unit cannot take the record", async () => {
    expect((await run("s3-upstream-transport", "freight", "tonne.km"))?.factor.externalId).toBe("ademe-ship");
    expect(await run("s3-business-travel", "travel", "kWh")).toBeNull();
  });

  it("never falls back for grid electricity or heat, or on a non-EPA run", async () => {
    expect(await run("s2-electricity-lb", "grid", "kWh")).toBeNull();
    expect(await run("s2-heat", "grid", "kWh")).toBeNull();
    expect(await run("s3-business-travel", "travel", "pkm", { id: "d26", name: "DEFRA" })).toBeNull();
  });
});
