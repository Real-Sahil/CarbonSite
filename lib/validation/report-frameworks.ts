// Framework-specific pre-generation validation for reports.
// Each framework has a list of checks; validate() runs them against the aggregated data
// and returns a FrameworkCheckResult[] describing what passed and what failed.

export type FrameworkCheck = {
  id: string;
  description: string;
  /** If true, a failure blocks generation. If false, it emits a warning only. */
  required: boolean;
};

export type FrameworkValidation = {
  framework: string;
  checks: FrameworkCheck[];
  validate: (data: ReportValidationInput) => FrameworkCheckResult[];
};

export type ReportValidationInput = {
  snapshotId: string;
  orgId: string;
  reportingPeriodId: string;
  /** Aggregated totals from DashboardAggregate, one entry per scope */
  scopeTotals: { scope: number; totalCo2e: number; recordCount: number }[];
  /** ActivityRecord counts grouped by EmissionCategory.code */
  categoryRecordCounts: { categoryCode: string; count: number }[];
  /** True when at least one ActivityRecord exists with a kWh unit */
  hasEnergyRecords: boolean;
  /** True when at least one Facility exists for this org */
  hasFacilities: boolean;
  /** Total number of ActivityRecords for this reporting period */
  totalRecords: number;
  /** Number of ActivityRecords with reviewStatus = 'approved' */
  approvedRecords: number;
};

export type FrameworkCheckResult = {
  check: FrameworkCheck;
  passed: boolean;
  message?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasScopeRecords(data: ReportValidationInput, scope: number): boolean {
  const entry = data.scopeTotals.find((s) => s.scope === scope);
  return (entry?.recordCount ?? 0) > 0;
}

function scopeCo2e(data: ReportValidationInput, scope: number): number {
  return data.scopeTotals.find((s) => s.scope === scope)?.totalCo2e ?? 0;
}

// ─── SECR ─────────────────────────────────────────────────────────────────────
// UK Streamlined Energy and Carbon Reporting

const secrChecks: FrameworkCheck[] = [
  {
    id: "secr-scope1",
    description: "Scope 1 records present (direct combustion, company vehicles)",
    required: true,
  },
  {
    id: "secr-scope2",
    description: "Scope 2 records present (purchased electricity, heat, steam)",
    required: true,
  },
  {
    id: "secr-energy",
    description: "Energy consumption records in kWh present (mandatory for SECR disclosure)",
    required: true,
  },
  {
    id: "secr-facility",
    description: "At least one facility defined for the organisation",
    required: true,
  },
];

function validateSecr(data: ReportValidationInput): FrameworkCheckResult[] {
  return secrChecks.map((check) => {
    switch (check.id) {
      case "secr-scope1":
        return {
          check,
          passed: hasScopeRecords(data, 1),
          message: hasScopeRecords(data, 1)
            ? undefined
            : "No Scope 1 activity records found. Add stationary combustion or mobile combustion records.",
        };
      case "secr-scope2":
        return {
          check,
          passed: hasScopeRecords(data, 2),
          message: hasScopeRecords(data, 2)
            ? undefined
            : "No Scope 2 activity records found. Add purchased electricity or heat records.",
        };
      case "secr-energy":
        return {
          check,
          passed: data.hasEnergyRecords,
          message: data.hasEnergyRecords
            ? undefined
            : "No energy records with kWh units found. SECR requires disclosure of absolute energy consumption in kWh.",
        };
      case "secr-facility":
        return {
          check,
          passed: data.hasFacilities,
          message: data.hasFacilities
            ? undefined
            : "No facilities defined. Add at least one facility under Settings to satisfy SECR location-based reporting.",
        };
      default:
        return { check, passed: true };
    }
  });
}

// ─── GHG Protocol ─────────────────────────────────────────────────────────────

const ghgProtocolChecks: FrameworkCheck[] = [
  {
    id: "ghg-scope1",
    description: "Scope 1 records present",
    required: true,
  },
  {
    id: "ghg-scope2",
    description: "Scope 2 records present",
    required: true,
  },
  {
    id: "ghg-approved",
    description: "All activity records are approved",
    required: false,
  },
];

function validateGhgProtocol(data: ReportValidationInput): FrameworkCheckResult[] {
  return ghgProtocolChecks.map((check) => {
    switch (check.id) {
      case "ghg-scope1":
        return {
          check,
          passed: hasScopeRecords(data, 1),
          message: hasScopeRecords(data, 1)
            ? undefined
            : "Scope 1 records are required for a complete GHG Protocol inventory.",
        };
      case "ghg-scope2":
        return {
          check,
          passed: hasScopeRecords(data, 2),
          message: hasScopeRecords(data, 2)
            ? undefined
            : "Scope 2 records are required for a complete GHG Protocol inventory.",
        };
      case "ghg-approved": {
        const allApproved =
          data.totalRecords > 0 && data.approvedRecords === data.totalRecords;
        return {
          check,
          passed: allApproved,
          message: allApproved
            ? undefined
            : `${data.totalRecords - data.approvedRecords} of ${data.totalRecords} records are not yet approved. GHG Protocol recommends all records are reviewed before reporting.`,
        };
      }
      default:
        return { check, passed: true };
    }
  });
}

// ─── CSRD ESRS E1 ─────────────────────────────────────────────────────────────
// EU Corporate Sustainability Reporting Directive — Climate Change

const csrdChecks: FrameworkCheck[] = [
  {
    id: "csrd-scope1",
    description: "Scope 1 records present and non-zero",
    required: true,
  },
  {
    id: "csrd-scope2",
    description: "Scope 2 records present and non-zero",
    required: true,
  },
  {
    id: "csrd-scope3",
    description: "Scope 3 records present and non-zero (value-chain emissions required by CSRD)",
    required: true,
  },
];

function validateCsrd(data: ReportValidationInput): FrameworkCheckResult[] {
  return csrdChecks.map((check) => {
    switch (check.id) {
      case "csrd-scope1": {
        const ok = hasScopeRecords(data, 1) && scopeCo2e(data, 1) > 0;
        return {
          check,
          passed: ok,
          message: ok
            ? undefined
            : "CSRD ESRS E1 requires non-zero Scope 1 emissions. Ensure Scope 1 records are present and approved.",
        };
      }
      case "csrd-scope2": {
        const ok = hasScopeRecords(data, 2) && scopeCo2e(data, 2) > 0;
        return {
          check,
          passed: ok,
          message: ok
            ? undefined
            : "CSRD ESRS E1 requires non-zero Scope 2 emissions. Ensure Scope 2 records are present and approved.",
        };
      }
      case "csrd-scope3": {
        const ok = hasScopeRecords(data, 3) && scopeCo2e(data, 3) > 0;
        return {
          check,
          passed: ok,
          message: ok
            ? undefined
            : "CSRD ESRS E1 requires non-zero Scope 3 (value-chain) emissions. Add upstream transport, purchased goods, or business travel records.",
        };
      }
      default:
        return { check, passed: true };
    }
  });
}

// ─── ISO 14064 ────────────────────────────────────────────────────────────────

const iso14064Checks: FrameworkCheck[] = [
  {
    id: "iso-scope1",
    description: "Scope 1 records present",
    required: true,
  },
  {
    id: "iso-scope2",
    description: "Scope 2 records present",
    required: true,
  },
  {
    id: "iso-methodology",
    description: "Methodology documentation note reviewed",
    required: false,
  },
];

function validateIso14064(data: ReportValidationInput): FrameworkCheckResult[] {
  return iso14064Checks.map((check) => {
    switch (check.id) {
      case "iso-scope1":
        return {
          check,
          passed: hasScopeRecords(data, 1),
          message: hasScopeRecords(data, 1)
            ? undefined
            : "ISO 14064 requires Scope 1 direct emission sources to be documented.",
        };
      case "iso-scope2":
        return {
          check,
          passed: hasScopeRecords(data, 2),
          message: hasScopeRecords(data, 2)
            ? undefined
            : "ISO 14064 requires Scope 2 indirect emission sources to be documented.",
        };
      case "iso-methodology":
        // This always passes but emits an advisory warning
        return {
          check,
          passed: true,
          message:
            "Review methodology version and GWP values in the calculation run before certification.",
        };
      default:
        return { check, passed: true };
    }
  });
}

// ─── Framework registry ───────────────────────────────────────────────────────

export const FRAMEWORK_VALIDATIONS: Record<string, FrameworkValidation> = {
  secr: {
    framework: "secr",
    checks: secrChecks,
    validate: validateSecr,
  },
  ghg_protocol: {
    framework: "ghg_protocol",
    checks: ghgProtocolChecks,
    validate: validateGhgProtocol,
  },
  csrd_esrs_e1: {
    framework: "csrd_esrs_e1",
    checks: csrdChecks,
    validate: validateCsrd,
  },
  iso_14064: {
    framework: "iso_14064",
    checks: iso14064Checks,
    validate: validateIso14064,
  },
};

/**
 * Map a Prisma ReportType to a framework key in FRAMEWORK_VALIDATIONS.
 * Returns null for report types that don't have framework-specific rules.
 */
export function reportTypeToFramework(reportType: string): string | null {
  const map: Record<string, string> = {
    secr: "secr",
    csrd_esrs_e1: "csrd_esrs_e1",
  };
  return map[reportType] ?? null;
}

/**
 * Default fallback validation — GHG Protocol rules apply to all inventory types.
 */
export function getFrameworkValidation(reportType: string): FrameworkValidation {
  const key = reportTypeToFramework(reportType);
  if (key && FRAMEWORK_VALIDATIONS[key]) {
    return FRAMEWORK_VALIDATIONS[key];
  }
  // Fall back to GHG Protocol checks for inventory / audit / snapshot types
  return FRAMEWORK_VALIDATIONS.ghg_protocol;
}
