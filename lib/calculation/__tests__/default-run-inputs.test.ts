// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  publishedSnapshot: { findFirst: vi.fn() },
  reportingPeriod: { findFirst: vi.fn() },
  factorLibrary: { findMany: vi.fn() },
  methodologyVersion: { findFirst: vi.fn() },
  organization: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { defaultRunInputs } from "../default-run-inputs";

const LIBRARIES = [
  { id: "epa", name: "EPA", version: "2025.1" },
  { id: "d251", name: "DEFRA", version: "2025.1" },
  { id: "d252", name: "DEFRA", version: "2025.2" },
  { id: "d261", name: "DEFRA", version: "2026.1" },
  { id: "uks", name: "Defra UK spend multipliers", version: "2023" },
  { id: "useeio", name: "EPA USEEIO", version: "1.3" },
  { id: "ademe", name: "ADEME Base Carbone", version: "2025.04" },
];

describe("defaultRunInputs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.factorLibrary.findMany.mockResolvedValue(LIBRARIES);
    db.methodologyVersion.findFirst.mockResolvedValue({ id: "m2" });
    db.organization.findUnique.mockResolvedValue({ hqCountry: "GB" });
  });

  it("reuses the library and methodology behind the period's published snapshot", async () => {
    db.publishedSnapshot.findFirst.mockResolvedValue({ calculationRun: { factorLibraryId: "d252", methodologyVersionId: "m1" } });
    expect(await defaultRunInputs("org", "p")).toEqual({ factorLibraryId: "d252", methodologyVersionId: "m1" });
  });

  it("otherwise takes the current DEFRA set for the period's end year, never EPA or a spend library", async () => {
    db.publishedSnapshot.findFirst.mockResolvedValue(null);
    db.reportingPeriod.findFirst.mockResolvedValue({ endDate: new Date("2025-12-31") });
    expect(await defaultRunInputs("org", "p")).toEqual({ factorLibraryId: "d252", methodologyVersionId: "m2" });
  });

  it("takes the national activity library for an organisation outside the UK", async () => {
    db.publishedSnapshot.findFirst.mockResolvedValue(null);
    db.reportingPeriod.findFirst.mockResolvedValue({ endDate: new Date("2025-12-31") });
    db.organization.findUnique.mockResolvedValue({ hqCountry: "United States" });
    expect((await defaultRunInputs("org", "p"))?.factorLibraryId).toBe("epa");
    db.organization.findUnique.mockResolvedValue({ hqCountry: "France" });
    expect((await defaultRunInputs("org", "p"))?.factorLibraryId).toBe("ademe");
    db.organization.findUnique.mockResolvedValue({ hqCountry: "Ireland" });
    expect((await defaultRunInputs("org", "p"))?.factorLibraryId).toBe("d252");
  });

  it("returns null for a period outside the organisation", async () => {
    db.publishedSnapshot.findFirst.mockResolvedValue(null);
    db.reportingPeriod.findFirst.mockResolvedValue(null);
    expect(await defaultRunInputs("org", "other")).toBeNull();
  });
});
