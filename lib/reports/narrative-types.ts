/**
 * Report types with their own layout and no inventory summary page: no
 * generated or team-written narrative is added to them (the ecology types
 * carry no GHG calculations, so wording about them would describe zeros).
 */
export const NO_NARRATIVE_TYPES = new Set([
  "bid_carbon_pack", "sustainability_report", "tcfd_statement", "site_noticeboard", "site_operations", "transition_plan",
  "national_toms", "cbam", "ecology_scan", "ecology_survey", "csrd_esrs_e3", "csrd_esrs_e5",
]);
