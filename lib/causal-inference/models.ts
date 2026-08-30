/**
 * Predefined Causal Models for CarbonSite
 * Three common emissions reduction scenarios with known causal structures
 */

export interface PredefinedModel {
  id: string;
  name: string;
  question: string;
  treatment: string;
  treatmentLabel: string;
  outcome: string;
  outcomeLabel: string;
  confounders: string[];
  confoundersLabels: Record<string, string>;
  causalGraph: string; // ASCII or Mermaid diagram
  interpretationGuide: string;
}

/**
 * Model 1: Facility Upgrade Impact
 * Question: "What emissions reduction did our facility upgrade achieve?"
 * Treatment: Facility upgraded (yes/no)
 * Outcome: Emissions reduction percentage
 * Confounders: Facility size, baseline emissions, industry type, time period
 */
export const facilityUpgradeModel: PredefinedModel = {
  id: "facility_upgrade",
  name: "Facility Upgrade Impact",
  question: "What is the causal impact of our facility upgrade on emissions?",
  treatment: "upgraded_facility",
  treatmentLabel: "Facility Upgraded (0=No, 1=Yes)",
  outcome: "emissions_reduction_pct",
  outcomeLabel: "Emissions Reduction (%)",
  confounders: ["facility_size_sqm", "baseline_emissions_tonnes", "industry_code", "days_since_upgrade"],
  confoundersLabels: {
    facility_size_sqm: "Facility Size (m²)",
    baseline_emissions_tonnes: "Baseline Emissions (tonnes CO₂e)",
    industry_code: "Industry Type (NAICS)",
    days_since_upgrade: "Days Since Upgrade",
  },
  causalGraph: `
    facility_size --> emissions_reduction_pct
    baseline_emissions --> emissions_reduction_pct
    industry_code --> emissions_reduction_pct
    upgraded_facility --> emissions_reduction_pct

    Confounders block non-causal paths to isolate upgrade effect
  `,
  interpretationGuide: `
  If ATE = 15%: Upgrading a facility causes ~15% emissions reduction.
  If 95% CI excludes 0: Effect is statistically significant.
  If robustness = 0.8: Effect persists under moderate unmeasured confounding.
  `,
};

/**
 * Model 2: Supplier Switch Impact
 * Question: "What emissions reduction came from switching suppliers?"
 * Treatment: Supplier switched (yes/no)
 * Outcome: Scope 3 emissions change
 * Confounders: Historical spend, supplier ratings, lead time, product volume
 */
export const supplierSwitchModel: PredefinedModel = {
  id: "supplier_switch",
  name: "Supplier Switch Impact",
  question: "What is the causal impact of switching suppliers on our Scope 3 emissions?",
  treatment: "switched_supplier",
  treatmentLabel: "Supplier Switched (0=No, 1=Yes)",
  outcome: "scope3_emissions_change",
  outcomeLabel: "Scope 3 Emissions Change (tonnes CO₂e)",
  confounders: ["historical_spend_gbp", "supplier_carbon_rating", "lead_time_days", "product_volume_units"],
  confoundersLabels: {
    historical_spend_gbp: "Historical Spend (£)",
    supplier_carbon_rating: "Supplier Carbon Rating (0-100)",
    lead_time_days: "Lead Time (days)",
    product_volume_units: "Product Volume (units)",
  },
  causalGraph: `
    historical_spend --> scope3_emissions_change
    supplier_carbon_rating --> scope3_emissions_change
    lead_time_days --> scope3_emissions_change
    product_volume --> scope3_emissions_change
    switched_supplier --> scope3_emissions_change

    Confounders account for selection bias (why company switched)
  `,
  interpretationGuide: `
  If ATE = -2 tonnes: Switching suppliers caused 2-tonne CO₂e reduction.
  If robustness = 0.6: Effect moderately robust to unmeasured confounding.
  If p-value < 0.05: Effect is statistically significant at 5% level.
  `,
};

/**
 * Model 3: Process Change Impact
 * Question: "What efficiency gains did our process change achieve?"
 * Treatment: Process changed (yes/no)
 * Outcome: Energy/waste reduction
 * Confounders: Process type, headcount, equipment age, adoption time
 */
export const processChangeModel: PredefinedModel = {
  id: "process_change",
  name: "Process Change Impact",
  question: "What is the causal impact of our process change on emissions?",
  treatment: "process_modified",
  treatmentLabel: "Process Modified (0=No, 1=Yes)",
  outcome: "efficiency_gain_pct",
  outcomeLabel: "Efficiency Gain (%)",
  confounders: ["process_type_code", "headcount", "equipment_age_years", "weeks_since_change"],
  confoundersLabels: {
    process_type_code: "Process Type (SIC)",
    headcount: "Team Headcount",
    equipment_age_years: "Equipment Age (years)",
    weeks_since_change: "Weeks Since Process Change",
  },
  causalGraph: `
    process_type_code --> efficiency_gain_pct
    headcount --> efficiency_gain_pct
    equipment_age_years --> efficiency_gain_pct
    weeks_since_change --> efficiency_gain_pct
    process_modified --> efficiency_gain_pct

    Confounders control for facility characteristics
  `,
  interpretationGuide: `
  If ATE = 8.5%: Process change causes 8.5% efficiency improvement.
  If backdoor_criterion_satisfied: Confounders adequately identified.
  If sensitivity_gamma > 2.0: Effect robust to 2x unmeasured confounding.
  `,
};

/**
 * Model registry for lookup
 */
export const modelRegistry: Record<string, PredefinedModel> = {
  facility_upgrade: facilityUpgradeModel,
  supplier_switch: supplierSwitchModel,
  process_change: processChangeModel,
};

/**
 * Get model by ID
 */
export function getModel(modelId: string): PredefinedModel | null {
  return modelRegistry[modelId] || null;
}

/**
 * List all available models
 */
export function listModels(): PredefinedModel[] {
  return Object.values(modelRegistry);
}

/**
 * Select model based on natural language question
 * Simplified keyword matching; upgrade to LLM in Phase 5E
 */
export function selectModelFromQuestion(question: string): PredefinedModel | null {
  const q = question.toLowerCase();

  if (q.includes("upgrade") || q.includes("equipment") || q.includes("facility")) {
    return facilityUpgradeModel;
  }

  if (q.includes("supplier") || q.includes("vendor") || q.includes("scope 3")) {
    return supplierSwitchModel;
  }

  if (q.includes("process") || q.includes("efficiency") || q.includes("workflow")) {
    return processChangeModel;
  }

  return null;
}
