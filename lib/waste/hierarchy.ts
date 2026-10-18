// Waste hierarchy position of each disposal route (same split as the ESRS E5
// report and the waste page): landfill, recovery (energy from waste), or
// recycling (including composting and anaerobic digestion). A route outside
// these lists is null, never counted as diverted: nothing says it was recycled.
const LANDFILL = new Set(["landfill_mixed", "landfill_food", "landfill_wood", "landfill_plastic", "hazardous_landfill"]);
const RECOVERY = new Set(["incineration_efw"]);
const RECYCLE = new Set([
  "recycling_paper", "recycling_cardboard", "recycling_plastic", "recycling_glass", "recycling_metal", "recycling_mixed",
  "composting_food", "composting_garden", "anaerobic_digestion",
]);

export type WasteHierarchy = "recycle" | "recovery" | "landfill";

export function wasteHierarchyOf(route: string): WasteHierarchy | null {
  if (LANDFILL.has(route)) return "landfill";
  if (RECOVERY.has(route)) return "recovery";
  if (RECYCLE.has(route)) return "recycle";
  return null;
}

/** Recycling or energy recovery. A landfill, and a route not recognised, is not diverted. */
export function isDiverted(route: string): boolean {
  const h = wasteHierarchyOf(route);
  return h === "recycle" || h === "recovery";
}
