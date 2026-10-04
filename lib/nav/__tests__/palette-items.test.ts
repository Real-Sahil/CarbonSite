import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTE_ITEMS, paletteMatches } from "../palette-items";

describe("palette items", () => {
  it("every destination is a real page", () => {
    for (const i of PALETTE_ITEMS) {
      expect(existsSync(join(process.cwd(), "app/(app)/orgs/[orgId]", i.path, "page.tsx")), i.path).toBe(true);
    }
  });

  it("shows a role only the pages it may open", () => {
    const labels = (role: string) => paletteMatches(PALETTE_ITEMS, role, "").map((i) => i.label);
    expect(labels("viewer")).not.toContain("Settings");
    expect(labels("viewer")).not.toContain("Submissions");
    expect(labels("admin")).toContain("Settings");
    expect(labels("reviewer")).toContain("Submissions");
  });

  it("matches every typed word against the label or keywords", () => {
    expect(paletteMatches(PALETTE_ITEMS, "admin", "net zero").map((i) => i.label)).toEqual(["Pathway"]);
    expect(paletteMatches(PALETTE_ITEMS, "admin", "rec").map((i) => i.label)).toContain("Records");
    expect(paletteMatches(PALETTE_ITEMS, "admin", "zzz")).toEqual([]);
  });
});
