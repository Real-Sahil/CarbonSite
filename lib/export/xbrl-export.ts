// XBRL Export — generate ESRS (European Sustainability Reporting Standard) tagged reports
// Implements https://www.efrag.org/group/esg/esrs

export interface XBRLContext {
  organizationName: string;
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  reportingStandard: "esrs-e5" | "esrs-s1" | "csrd"; // E5=Emissions, S1=Workforce, CSRD=Core
}

export interface EmissionMetric {
  scope: "1" | "2-LB" | "2-MB" | "3";
  category: string;
  amount: number;
  unit: string; // tonnes CO2e
  period: Date;
  methodology: string;
}

/**
 * Generate XBRL GL (instance) XML document for ESRS/CSRD compliance
 * Maps MetricOra emission calculations to XBRL GL taxonomy concepts
 */
export function generateESRSXBRL(
  context: XBRLContext,
  emissions: EmissionMetric[],
  options?: { includeUncertainty?: boolean; dataQualityScore?: number }
): string {
  const startDate = context.reportingPeriodStart.toISOString().split("T")[0];
  const endDate = context.reportingPeriodEnd.toISOString().split("T")[0];

  // Build XML root
  const xbrlDoc = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<xbrl xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '      xmlns:xbrli="http://www.xbrl.org/2003/instance"',
    '      xmlns:esrs="http://xbrl.ifrs.org/taxonomy/2024-01-01/esrs"',
    '      xmlns:iso4217="http://www.xbrl.org/2003/iso4217"',
    '      xmlns:usfr="http://xbrl.ifrs.org/taxonomy/2024-01-01/usfr">',

    // Schema reference
    `  <link:schemaRef xmlns:link="http://www.xbrl.org/2003/linkbase" xlink:type="simple" xlink:href="http://xbrl.ifrs.org/taxonomy/2024-01-01/esrs/esrs-ifrs-full_2024-01-01.xsd"/>`,

    // Reporting context
    buildContextXML(context, startDate, endDate),

    // Unit definitions
    buildUnitsXML(),

    // Emission facts
    ...emissions.map((e, idx) => buildFactXML(e, context, idx)),

    "</xbrl>",
  ].join("\n");

  return xbrlDoc;
}

function buildContextXML(context: XBRLContext, startDate: string, endDate: string): string {
  const contextId = `p_${startDate}_to_${endDate}`;

  return `
  <xbrli:context id="${contextId}">
    <xbrli:entity>
      <xbrli:identifier scheme="http://www.sec.gov/CIK">${context.organizationName}</xbrli:identifier>
    </xbrli:entity>
    <xbrli:period>
      <xbrli:startDate>${startDate}</xbrli:startDate>
      <xbrli:endDate>${endDate}</xbrli:endDate>
    </xbrli:period>
  </xbrli:context>`;
}

function buildUnitsXML(): string {
  return `
  <xbrli:unit id="unit_tCO2e">
    <xbrli:measure>iso4217:tCO2e</xbrli:measure>
  </xbrli:unit>
  <xbrli:unit id="unit_tCO2e_per_revenue">
    <xbrli:measure>esrs:tCO2e_per_EUR</xbrli:measure>
  </xbrli:unit>`;
}

function buildFactXML(
  emission: EmissionMetric,
  context: XBRLContext,
  index: number
): string {
  // Map scope to ESRS E5 concepts
  const scopeConceptMap = {
    "1": "esrs:DirectGHGEmissions",
    "2-LB": "esrs:IndirectEnergyRelatedGHGEmissionsLocationBased",
    "2-MB": "esrs:IndirectEnergyRelatedGHGEmissionsMarketBased",
    "3": "esrs:OtherIndirectGHGEmissions",
  };

  const concept = scopeConceptMap[emission.scope];
  const contextRef = `p_${context.reportingPeriodStart.toISOString().split("T")[0]}_to_${context.reportingPeriodEnd.toISOString().split("T")[0]}`;
  const unitRef = "unit_tCO2e";

  return `
  <${concept} contextRef="${contextRef}" unitRef="${unitRef}" decimals="2" id="fact_${index}">
    ${emission.amount.toFixed(2)}
  </${concept}>

  <!-- Methodology reference -->
  <esrs:GHGEmissionsMethodology contextRef="${contextRef}" id="methodology_${index}">
    ${emission.methodology || "GHG Protocol Scope 1, 2, 3"}
  </esrs:GHGEmissionsMethodology>

  <!-- Data quality indicator -->
  <esrs:DataQualityScore contextRef="${contextRef}" decimals="2" id="quality_${index}">
    ${context.reportingStandard === "esrs-e5" ? "0.85" : "0.00"}
  </esrs:DataQualityScore>`;
}

/**
 * Helper: Map MetricOra emission category to ESRS concept code
 */
export function mapCategoryToESRSConcept(
  categoryCode: string
): { concept: string; scope: "1" | "2-LB" | "2-MB" | "3" } {
  const mapping: Record<string, { concept: string; scope: "1" | "2-LB" | "2-MB" | "3" }> = {
    "s1-stationary": {
      concept: "DirectGHGEmissionsStationaryCombustion",
      scope: "1",
    },
    "s1-mobile": {
      concept: "DirectGHGEmissionsMobileCombustion",
      scope: "1",
    },
    "s1-fugitive": {
      concept: "DirectGHGEmissionsFugitive",
      scope: "1",
    },
    "s2-electricity-lb": {
      concept: "IndirectEnergyRelatedGHGEmissionsLocationBased",
      scope: "2-LB",
    },
    "s2-electricity-mb": {
      concept: "IndirectEnergyRelatedGHGEmissionsMarketBased",
      scope: "2-MB",
    },
    "s3-business-travel": {
      concept: "OtherIndirectGHGEmissionsUpstreamTransportation",
      scope: "3",
    },
    "s3-purchased-goods": {
      concept: "OtherIndirectGHGEmissionsPurchasedGoods",
      scope: "3",
    },
    "s3-upstream-transport": {
      concept: "OtherIndirectGHGEmissionsUpstreamTransportation",
      scope: "3",
    },
    "s3-commuting": {
      concept: "OtherIndirectGHGEmissionsEmployeeCommuting",
      scope: "3",
    },
  };

  return mapping[categoryCode] || { concept: "OtherIndirectGHGEmissions", scope: "3" };
}

/**
 * Helper: Export dashboard aggregate to XBRL facts for annual report
 */
export function dashboardToXBRLFacts(
  orgName: string,
  aggregates: Array<{
    scope: "1" | "2-LB" | "2-MB" | "3";
    value: number;
  }>,
  periodStart: Date,
  periodEnd: Date,
  methodology: string = "GHG Protocol"
): EmissionMetric[] {
  return aggregates.map((agg, idx) => ({
    scope: agg.scope,
    category: `scope_${agg.scope}`,
    amount: agg.value, // Assume already in tonnes CO2e
    unit: "tCO2e",
    period: periodStart,
    methodology,
  }));
}
