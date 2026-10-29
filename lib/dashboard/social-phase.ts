// The Social tile shows where an organisation is, never a grade. The phase follows from which
// inputs exist, so it can only move forward when something real has been added.

export type SocialInputs = {
  /** A workforce, supplier or community data source is connected or has records. */
  sourcesConnected: boolean;
  /** At least one record has been processed and reviewed. */
  firstDataProcessed: boolean;
  /** A baseline year is recorded for the social measures. */
  baselineRecorded: boolean;
  /** Variance against the baseline is tracked on a live feed. */
  liveVariance: boolean;
};

export type SocialPhase = "data_mapping" | "initial_audit" | "baseline_established" | "active_monitoring";

export const SOCIAL_PHASE_LABEL: Record<SocialPhase, string> = {
  data_mapping: "Data Mapping",
  initial_audit: "Initial Audit",
  baseline_established: "Baseline Established",
  active_monitoring: "Active Monitoring",
};

export const SOCIAL_PHASE_ORDER: SocialPhase[] = ["data_mapping", "initial_audit", "baseline_established", "active_monitoring"];

export function socialPhase(i: SocialInputs): SocialPhase {
  if (i.baselineRecorded && i.liveVariance) return "active_monitoring";
  if (i.baselineRecorded) return "baseline_established";
  if (i.firstDataProcessed) return "initial_audit";
  return "data_mapping";
}
