// The VSME, the voluntary sustainability reporting standard for non-listed
// micro, small and medium-sized undertakings: a Basic module (B1 to B11) and a
// Comprehensive module (C1 to C9). Titles and guidance are MetricOra's own and
// say where in MetricOra the figures live; the standard's text is not copied.
//
// The Commission published a Recommendation on 30 July 2025 and, according to
// EFRAG, a Voluntary Standard on 3 July 2026; EFRAG is updating its template
// and XBRL taxonomy (due Q4 2026). When that lands, add a new edition with
// revise() rather than editing this one.

import type { CatalogueFramework } from "./types";

export const vsme: CatalogueFramework = {
  slug: "vsme-2025",
  name: "VSME voluntary sustainability reporting standard for SMEs",
  shortName: "VSME",
  edition: "Commission Recommendation of 30 July 2025 (EFRAG is updating its materials for the 2026 Voluntary Standard)",
  publisher: "European Commission, with EFRAG",
  family: "sustainability_reporting",
  jurisdiction: "European Union",
  summary:
    "A proportionate way for smaller companies to answer the sustainability questions customers, banks and investors keep sending. Voluntary: whether a customer or lender asks for it is a commercial matter, and larger customers in scope of the CSRD often use it to collect supplier data.",
  sourceUrl: "https://www.efrag.org/en/vsme-digital-template-and-xbrl-taxonomy",
  contentBasis: "references",
  contentNote:
    "Disclosure numbers and short titles with MetricOra's own guidance. EFRAG's Digital Template and converter are MIT-licensed and its taxonomy is open; this catalogue does not reproduce them. Check which edition your customers ask for.",
  certifiable: false,
  editionSources: [{ label: "EFRAG: VSME Digital Template and XBRL Taxonomy", url: "https://www.efrag.org/en/vsme-digital-template-and-xbrl-taxonomy" }],
  requirements: [
    { code: "Basic", title: "Basic module" },
    { code: "B1", parent: "Basic", title: "Basis for preparation", guidance: "Say which module you report under, whether on an individual or consolidated basis, and which subsidiaries are included. Your organisation's legal entities and the boundary approach are recorded under Boundary.", evidenceHints: ["Boundary statement", "Legal entity list"] },
    { code: "B2", parent: "Basic", title: "Practices, policies and future initiatives for transitioning to a more sustainable economy", guidance: "List the sustainability practices and policies you have, and the initiatives you plan. Approved policies in the Policies register are the natural evidence.", evidenceHints: ["Approved policies", "Reduction initiatives"], signals: ["ms_policies"] },
    { code: "B3", parent: "Basic", title: "Energy and greenhouse gas emissions", guidance: "Report energy use by fuel and electricity, and Scope 1 and 2 emissions, with Scope 3 where you have it. These come from your published snapshot; the report type used for customers is the GHG Protocol inventory.", evidenceHints: ["Published snapshot", "Utility bills"], signals: ["emissions_monitoring"] },
    { code: "B4", parent: "Basic", title: "Pollution of air, water and soil", guidance: "State the pollutants you release to air, water and soil above the reporting thresholds, or that you have none to report. Incidents and permits are recorded under Environment.", evidenceHints: ["Permits", "Incident log"], signals: ["environmental_incidents"] },
    { code: "B5", parent: "Basic", title: "Biodiversity", guidance: "Report land use and sealed area at your sites, and any site in or near a protected area. Site facts are on each facility; ecology surveys sit under Ecology.", evidenceHints: ["Site list with land use"], signals: ["environmental_aspects"] },
    { code: "B6", parent: "Basic", title: "Water", guidance: "Report water withdrawal, and consumption where a site is in a water-stressed area. Water records and each facility's water-stress class hold the figures.", evidenceHints: ["Water records"], signals: ["waste_water_monitoring"] },
    { code: "B7", parent: "Basic", title: "Resource use, circular economy and waste management", guidance: "Report waste by type and treatment route, with hazardous waste separate, and your approach to circularity. The waste register holds the tonnes and routes.", evidenceHints: ["Waste records", "Waste transfer notes"], signals: ["waste_water_monitoring"] },
    { code: "B8", parent: "Basic", title: "Workforce: general characteristics", guidance: "Report headcount or full-time equivalents by contract type and gender, and by country if you operate in several. This is your own HR data; MetricOra does not hold it except where you record it on a reporting period.", evidenceHints: ["HR headcount extract"] },
    { code: "B9", parent: "Basic", title: "Workforce: health and safety", guidance: "Report work-related accidents, ill health and fatalities, with rates. Incident reports are under Health and safety.", evidenceHints: ["Incident reports"], signals: ["hs_incidents"] },
    { code: "B10", parent: "Basic", title: "Workforce: remuneration, collective bargaining and training", guidance: "Report the share of employees paid below the adequate wage benchmark, the gender pay gap, collective bargaining coverage and training hours. Training records give the hours; pay data is yours.", evidenceHints: ["Training matrix", "Payroll extract"], signals: ["ms_training"] },
    { code: "B11", parent: "Basic", title: "Convictions and fines for corruption and bribery", guidance: "State the number of convictions and the amount of fines for corruption or bribery in the period, or that there were none.", evidenceHints: ["Legal confirmation"] },
    { code: "Comprehensive", title: "Comprehensive module" },
    { code: "C1", parent: "Comprehensive", title: "Strategy: business model and sustainability-related initiatives", guidance: "Describe your business model, main products, markets and value chain, and the sustainability initiatives within it." },
    { code: "C2", parent: "Comprehensive", title: "Description of practices, policies and future initiatives for transitioning to a more sustainable economy", guidance: "Describe, per sustainability topic, the practices and policies in place and whether top management is accountable for them.", signals: ["ms_policies"] },
    { code: "C3", parent: "Comprehensive", title: "Greenhouse gas emission reduction targets and climate transition", guidance: "Report your targets for cutting Scope 1, 2 and 3 emissions and the actions you will take. Targets and the transition plan are in MetricOra under Targets and Carbon forecast.", evidenceHints: ["Reduction targets", "Transition plan"], signals: ["reduction_targets"] },
    { code: "C4", parent: "Comprehensive", title: "Climate risks", guidance: "Identify climate-related physical and transition risks to your business and how you assess them. Your climate risk assessments feed this directly.", evidenceHints: ["TCFD risk assessments"], signals: ["ms_risks"] },
    { code: "C5", parent: "Comprehensive", title: "Additional general workforce characteristics", guidance: "Report further workforce detail beyond B8, such as turnover, and the use of workers who are not employees." },
    { code: "C6", parent: "Comprehensive", title: "Additional workforce information: human rights policies and processes", guidance: "Describe your human rights policy and the processes for raising concerns and remedying harm in your own workforce and value chain." },
    { code: "C7", parent: "Comprehensive", title: "Severe negative human rights incidents", guidance: "Report any severe human rights incident in your own workforce, value chain or affected communities, or that there were none." },
    { code: "C8", parent: "Comprehensive", title: "Revenues from certain sectors and exclusion from EU reference benchmarks", guidance: "State whether you earn revenue from controversial weapons, tobacco, fossil fuels or chemicals, and the share, or that you do not." },
    { code: "C9", parent: "Comprehensive", title: "Gender diversity ratio in the governance body", guidance: "Report the number of women and men on your governance body and the ratio." },
  ],
};
