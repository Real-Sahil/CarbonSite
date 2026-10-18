import { describe, expect, it } from "vitest";
import { isDiverted, wasteHierarchyOf } from "../hierarchy";

describe("wasteHierarchyOf", () => {
  it("places each known route on the waste hierarchy", () => {
    expect(wasteHierarchyOf("landfill_mixed")).toBe("landfill");
    expect(wasteHierarchyOf("hazardous_landfill")).toBe("landfill");
    expect(wasteHierarchyOf("incineration_efw")).toBe("recovery");
    expect(wasteHierarchyOf("recycling_metal")).toBe("recycle");
    expect(wasteHierarchyOf("composting_garden")).toBe("recycle");
    expect(wasteHierarchyOf("anaerobic_digestion")).toBe("recycle");
  });

  it("returns null for a route it does not know, never a default", () => {
    expect(wasteHierarchyOf("dump")).toBeNull();
    expect(wasteHierarchyOf("")).toBeNull();
  });
});

describe("isDiverted", () => {
  it("counts recycling, composting and energy recovery as diverted", () => {
    expect(isDiverted("recycling_paper")).toBe(true);
    expect(isDiverted("composting_food")).toBe(true);
    expect(isDiverted("incineration_efw")).toBe(true);
  });

  it("does not count any landfill, including hazardous, as diverted", () => {
    expect(isDiverted("landfill_food")).toBe(false);
    expect(isDiverted("hazardous_landfill")).toBe(false);
  });

  it("does not count an unknown or blank route as diverted", () => {
    expect(isDiverted("dump")).toBe(false);
    expect(isDiverted("")).toBe(false);
  });
});
