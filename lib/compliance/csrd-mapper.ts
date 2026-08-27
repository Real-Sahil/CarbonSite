// CSRD (Corporate Sustainability Reporting Directive) compliance mapper.
// Maps GHG Protocol Scopes to CSRD Article 8 requirements and ESG taxonomies.

export type CSRDScope = "1" | "2" | "3" | "all";

export type CSRDArticle8Requirement = {
  article: string; // e.g., "Article 8.1"
  requirement: string;
  scope: CSRDScope;
  mandatory: boolean;
  timeline?: string; // e.g., "2025 reporting", "2026 reporting"
};

export type CSRDEmissionCategory = {
  categoryCode: string; // e.g., "s1-stationary"
  categoryName: string;
  csrdAnnexMapping: string; // e.g., "Annex I, Part E, Section 1"
  esaTaxonomy?: string; // Environmental Sustainability Taxonomy
  dnshCriteria?: string; // Do No Significant Harm criteria
  description: string;
};

export type CSRDComplianceMapping = {
  organizationId: string;
  reportingYear: number;
  mandatoryRequirements: CSRDArticle8Requirement[];
  scope1Emissions?: number;
  scope2Emissions?: number;
  scope3Emissions?: number;
  totalEmissions?: number;
  complianceStatus: "compliant" | "partial" | "non-compliant";
  missingData: string[];
  recommendations: string[];
  nextSteps: CSRDMilestone[];
};

export type CSRDMilestone = {
  year: number;
  deadline: string; // e.g., "31 Dec 2024"
  requirement: string;
  status: "pending" | "in-progress" | "completed";
};

// CSRD Article 8 mandatory disclosures (CSRD became mandatory 2025 for certain org sizes)
const CSRD_ARTICLE_8_REQUIREMENTS: CSRDArticle8Requirement[] = [
  {
    article: "Article 8.1(a)",
    requirement: "Disclose Scope 1 GHG emissions (Direct emissions from owned/controlled sources)",
    scope: "1",
    mandatory: true,
    timeline: "2025 reporting (for large orgs)",
  },
  {
    article: "Article 8.1(b)",
    requirement: "Disclose Scope 2 GHG emissions (Indirect energy emissions, location-based and market-based)",
    scope: "2",
    mandatory: true,
    timeline: "2025 reporting",
  },
  {
    article: "Article 8.1(c)",
    requirement:
      "Disclose Scope 3 GHG emissions (All other indirect emissions). Mandatory only if material; phased implementation by 2028",
    scope: "3",
    mandatory: false,
    timeline: "2028 reporting",
  },
  {
    article: "Article 8.1(d)",
    requirement: "Disclose energy consumption (kWh) from renewable and non-renewable sources",
    scope: "2",
    mandatory: true,
    timeline: "2025 reporting",
  },
  {
    article: "Article 8.1(e)",
    requirement: "Disclose methodology and assumptions (e.g., emission factors, scope definitions)",
    scope: "all",
    mandatory: true,
    timeline: "2025 reporting",
  },
  {
    article: "Article 8.1(f)",
    requirement:
      "Disclose verified emissions data and assurance statement (Third-party limited or reasonable assurance required)",
    scope: "all",
    mandatory: true,
    timeline: "2026 reporting onwards (phased timeline)",
  },
];

// CSRD Annex I mappings for emission categories
const CSRD_CATEGORY_MAPPINGS: Record<string, CSRDEmissionCategory> = {
  "s1-stationary": {
    categoryCode: "s1-stationary",
    categoryName: "Direct fuel combustion (stationary)",
    csrdAnnexMapping: "Annex I, Part E, Section 1.1",
    dnshCriteria: "Climate mitigation: emissions must reduce towards Paris 1.5°C",
    description:
      "Direct emissions from combustion of fossil fuels in owned/controlled stationary equipment (boilers, furnaces, generators)",
  },
  "s1-mobile": {
    categoryCode: "s1-mobile",
    categoryName: "Direct fuel combustion (mobile)",
    csrdAnnexMapping: "Annex I, Part E, Section 1.2",
    dnshCriteria: "Climate mitigation: zero-emission vehicles prioritized",
    description: "Direct emissions from company-owned or operated vehicle fleet",
  },
  "s2-electricity-lb": {
    categoryCode: "s2-electricity-lb",
    categoryName: "Purchased electricity (location-based)",
    csrdAnnexMapping: "Annex I, Part E, Section 2.1",
    esaTaxonomy: "Renewable energy generation and distribution",
    dnshCriteria: "Transition to renewable electricity sources",
    description:
      "Indirect emissions from purchased electricity, using location-based grid factors (national average grid mix)",
  },
  "s2-electricity-mb": {
    categoryCode: "s2-electricity-mb",
    categoryName: "Purchased electricity (market-based)",
    csrdAnnexMapping: "Annex I, Part E, Section 2.1",
    esaTaxonomy: "Renewable energy generation and distribution",
    dnshCriteria: "Renewable energy procurement alignment",
    description:
      "Indirect emissions from purchased electricity, using market-based factors (accounting for renewable procurement, RECs)",
  },
  "s3-purchased-goods": {
    categoryCode: "s3-purchased-goods",
    categoryName: "Scope 3: Purchased goods and services",
    csrdAnnexMapping: "Annex I, Part E, Section 3 (phased)",
    esaTaxonomy: "Sustainable resource use and circular economy",
    dnshCriteria: "Supplier emissions must be on declining trajectory",
    description:
      "Indirect emissions from extraction and production of purchased goods and services. CSRD mandatory by 2028; currently encouraged for transparency.",
  },
  "s3-upstream-transport": {
    categoryCode: "s3-upstream-transport",
    categoryName: "Scope 3: Upstream transportation and distribution",
    csrdAnnexMapping: "Annex I, Part E, Section 3 (phased)",
    dnshCriteria: "Modal shift to lower-emission transport (rail vs. road)",
    description:
      "Indirect emissions from third-party transportation of purchased goods and raw materials. Part of phased Scope 3 mandate.",
  },
  "s3-business-travel": {
    categoryCode: "s3-business-travel",
    categoryName: "Scope 3: Business travel",
    csrdAnnexMapping: "Annex I, Part E, Section 3 (phased)",
    dnshCriteria: "Shift from air to lower-emission modes (rail, video conferencing)",
    description:
      "Indirect emissions from employee business travel by air, rail, road, and accommodation. Common disclosure starting point for Scope 3.",
  },
};

// CSRD timeline and regulatory milestones
const CSRD_MILESTONES: CSRDMilestone[] = [
  {
    year: 2025,
    deadline: "31 Dec 2025",
    requirement: "First CSRD report: Scope 1 + 2 emissions (large orgs, >500 employees)",
    status: "pending",
  },
  {
    year: 2026,
    deadline: "31 Dec 2026",
    requirement: "CSRD assurance: Limited or reasonable third-party verification (phased roll-out)",
    status: "pending",
  },
  {
    year: 2027,
    deadline: "31 Dec 2027",
    requirement: "Scope 3 encouragement: Report Scope 3 if material (non-mandatory pilot phase)",
    status: "pending",
  },
  {
    year: 2028,
    deadline: "31 Dec 2028",
    requirement: "Scope 3 mandatory: All orgs must report Scope 3 (if material) under CSRD",
    status: "pending",
  },
  {
    year: 2029,
    deadline: "31 Dec 2029",
    requirement: "Extended scope: CSRD applies to all large non-EU orgs with EU presence",
    status: "pending",
  },
];

export function generateCSRDCompliance(req: {
  organizationId: string;
  reportingYear: number;
  scope1?: number;
  scope2?: number;
  scope3?: number;
}): CSRDComplianceMapping {
  const mandatory = CSRD_ARTICLE_8_REQUIREMENTS.filter((r) => r.mandatory);
  const optional = CSRD_ARTICLE_8_REQUIREMENTS.filter((r) => !r.mandatory);

  const missingData: string[] = [];
  if (!req.scope1) missingData.push("Scope 1 emissions data not provided");
  if (!req.scope2) missingData.push("Scope 2 emissions data (location and market-based) not provided");
  if (!req.scope3) missingData.push("Scope 3 emissions data not provided (optional but recommended)");

  const totalEmissions = (req.scope1 || 0) + (req.scope2 || 0) + (req.scope3 || 0);

  // Determine compliance status
  let complianceStatus: "compliant" | "partial" | "non-compliant" = "compliant";
  if (req.scope1 === undefined || req.scope2 === undefined) {
    complianceStatus = "non-compliant";
  } else if (totalEmissions === 0) {
    complianceStatus = "partial";
  }

  // Generate recommendations
  const recommendations = generateCSRDRecommendations(req);

  // Calculate milestones
  const upcomingMilestones: CSRDMilestone[] = CSRD_MILESTONES.map((m) => {
    const status: "completed" | "pending" | "in-progress" = req.reportingYear >= m.year ? "completed" : "pending";
    return { ...m, status };
  });

  return {
    organizationId: req.organizationId,
    reportingYear: req.reportingYear,
    mandatoryRequirements: mandatory,
    scope1Emissions: req.scope1,
    scope2Emissions: req.scope2,
    scope3Emissions: req.scope3,
    totalEmissions: totalEmissions,
    complianceStatus,
    missingData,
    recommendations,
    nextSteps: upcomingMilestones,
  };
}

function generateCSRDRecommendations(req: {
  scope1?: number;
  scope2?: number;
  scope3?: number;
}): string[] {
  const recommendations: string[] = [];

  // Scope 1 recommendations
  if (req.scope1 === undefined) {
    recommendations.push(
      "CRITICAL: Provide Scope 1 emissions data (direct fuel combustion). Required for 2025 CSRD reporting.",
    );
  } else if (req.scope1 > 0) {
    recommendations.push("Scope 1: Implement fuel switching or electrification roadmap. Document transition plan with milestones.");
  }

  // Scope 2 recommendations
  if (req.scope2 === undefined) {
    recommendations.push(
      "CRITICAL: Provide Scope 2 emissions (purchased electricity, both location-based and market-based). Required for 2025 CSRD reporting.",
    );
  } else if (req.scope2 > 0) {
    const pctOfTotal = req.scope2 / ((req.scope1 || 0) + (req.scope2 || 0) + (req.scope3 || 0));
    if (pctOfTotal > 0.3) {
      recommendations.push(
        "Scope 2: >30% of emissions. Prioritize renewable energy procurement (PPAs, green tariffs, RECs). Target: 50% renewable by 2025.",
      );
    }
  }

  // Scope 3 recommendations
  if (req.scope3 === undefined) {
    recommendations.push(
      "Scope 3: Data currently optional. Begin collecting spend-based Scope 3 data now to prepare for 2028 CSRD mandate.",
    );
  } else if (req.scope3 > 0) {
    const pctOfTotal = req.scope3 / ((req.scope1 || 0) + (req.scope2 || 0) + (req.scope3 || 0));
    if (pctOfTotal > 0.6) {
      recommendations.push(
        "Scope 3: >60% of emissions. Engage suppliers: set SBTi targets for top 50% of emissions. Implement supplier verification program.",
      );
    }
    recommendations.push(
      "Scope 3: Prepare detailed category breakdown (purchased goods, business travel, logistics). Will be mandatory reporting element in 2028.",
    );
  }

  recommendations.push(
    "Assurance: Plan for third-party limited or reasonable assurance (CSRD requirement from 2026). Select auditor and document data collection process.",
  );

  return recommendations;
}

export function getCSRDCategoryMapping(categoryCode: string): CSRDEmissionCategory | undefined {
  return CSRD_CATEGORY_MAPPINGS[categoryCode];
}

export function getAllCSRDCategoryMappings(): CSRDEmissionCategory[] {
  return Object.values(CSRD_CATEGORY_MAPPINGS);
}
