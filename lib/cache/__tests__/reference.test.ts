import { beforeEach, describe, expect, it, vi } from "vitest";

const categories = vi.fn();
const libraries = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { emissionCategory: { findMany: categories }, factorLibrary: { findMany: libraries } } }));

describe("reference cache", () => {
  beforeEach(() => {
    categories.mockReset();
    libraries.mockReset();
  });

  it("reads straight from the database outside the Next.js runtime", async () => {
    categories.mockResolvedValue([{ id: "c1", scope: 1, code: "s1-stationary", name: "Fuel" }]);
    const { getEmissionCategories } = await import("../reference");
    expect(await getEmissionCategories()).toEqual([{ id: "c1", scope: 1, code: "s1-stationary", name: "Fuel" }]);
  });

  it("asks for shared data only: no organisation filter on either read", async () => {
    categories.mockResolvedValue([]);
    libraries.mockResolvedValue([]);
    const { getEmissionCategories, getFactorLibraries } = await import("../reference");
    await getEmissionCategories();
    await getFactorLibraries();
    for (const call of [categories.mock.calls[0][0], libraries.mock.calls[0][0]]) {
      expect(JSON.stringify(call)).not.toMatch(/organi[sz]ation/i);
      expect(call.where).toBeUndefined();
    }
  });

  it("passes a database error through instead of treating it as a missing cache", async () => {
    libraries.mockRejectedValue(new Error("connection refused"));
    const { getFactorLibraries } = await import("../reference");
    await expect(getFactorLibraries()).rejects.toThrow("connection refused");
  });
});
