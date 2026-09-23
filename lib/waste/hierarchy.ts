// Waste hierarchy position of each disposal route (same split as the
// ESRS E5 report and the waste page): landfill, recovery (energy from
// waste), or recycling (including composting and anaerobic digestion).
const LANDFILL = new Set(["landfill_mixed", "landfill_food", "landfill_wood", "landfill_plastic", "hazardous_landfill"]);
const RECOVERY = new Set(["incineration_efw"]);

export type WasteHierarchy = "recycle" | "recovery" | "landfill";

export function wasteHierarchyOf(route: string): WasteHierarchy {
  return LANDFILL.has(route) ? "landfill" : RECOVERY.has(route) ? "recovery" : "recycle";
}
