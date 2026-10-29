// Disclosure regimes an organisation can choose for the Executive Summary's Audit tile. Each maps to the
// framework datapoint sets already loaded in FrameworkDatapoint; nothing here invents a requirement.

export const DISCLOSURE_REGIMES = {
  uk_secr: { label: "UK SECR", framework: "secr" },
  esrs_e1: { label: "ESRS E1 (CSRD)", framework: "esrs_e1" },
  ifrs_s2: { label: "IFRS S2", framework: "ifrs_s2" },
  ghg_protocol: { label: "GHG Protocol", framework: "ghg_protocol" },
} as const;

export type DisclosureRegime = keyof typeof DISCLOSURE_REGIMES;

export const DISCLOSURE_REGIME_KEYS = Object.keys(DISCLOSURE_REGIMES) as [DisclosureRegime, ...DisclosureRegime[]];

export function isDisclosureRegime(v: string | null | undefined): v is DisclosureRegime {
  return v != null && Object.prototype.hasOwnProperty.call(DISCLOSURE_REGIMES, v);
}

export type ReadinessStatus = "satisfied" | "partial" | "gap" | "not_applicable";

// Same rule as the crosswalk page: readiness is satisfied over applicable; not_applicable leaves the denominator.
export function readinessCounts(statuses: ReadinessStatus[]) {
  const applicable = statuses.filter((s) => s !== "not_applicable");
  const satisfied = applicable.filter((s) => s === "satisfied").length;
  return {
    applicable: applicable.length,
    satisfied,
    partial: applicable.filter((s) => s === "partial").length,
    gap: applicable.filter((s) => s === "gap").length,
    percent: applicable.length > 0 ? (satisfied / applicable.length) * 100 : null,
  };
}
