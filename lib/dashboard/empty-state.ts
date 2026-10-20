// Copy for the dashboard scope panel when it has no figures to show.
// The page supplies the facts; this decides what the person is told and where to go.

export type ScopeEmptyInput = {
  orgId: string;
  periodLabel: string | null;
  // The period has a calculation run with live rollups.
  calculated: boolean;
  // Those live rollups hold a non-zero total or records.
  hasFigures: boolean;
  // Set only when a project is the one filter in force.
  projectName: string | null;
};

export type ScopeEmptyState = {
  title: string;
  description: string;
  href?: string;
  action?: string;
};

export function scopeEmptyState(input: ScopeEmptyInput): ScopeEmptyState {
  const period = input.periodLabel ?? "The current period";
  const records = `/orgs/${input.orgId}/records`;

  if (!input.calculated) {
    return {
      title: "No calculated figures for this period yet",
      description: `${period} has no calculation run. Approve records, then run a calculation to fill the scope, category, trend and intelligence panels.`,
      href: "#run-calculation",
      action: "Run calculation",
    };
  }
  if (!input.hasFigures) {
    return {
      title: "The calculation counted no emissions",
      description: `${period} was calculated, but its records add up to nothing. Check amounts, units and categories on the records, then run the calculation again.`,
      href: records,
      action: "Open records",
    };
  }
  if (input.projectName) {
    return {
      title: `No calculated figures for ${input.projectName}`,
      description: `${period} has figures, but none reach ${input.projectName}. Records reach a project only through a project site, and the record form does not set one yet. Choose All projects to see the whole period.`,
    };
  }
  return {
    title: "No calculated figures match these filters",
    description: `${period} has figures, but none match the filters in force. Clear a filter to see the whole period.`,
  };
}
