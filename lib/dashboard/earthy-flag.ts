// Rollout switch for the Executive Summary (docs/design/earthy-tech/implementation_plan.md, phase 0).
// The Earthy dashboard is the platform default: every organisation, current and future, gets it with no
// variable set. EARTHY_DASHBOARD_ORGS is only a rollback lever: "off" (nobody) or a comma-separated list of
// organisation ids (only those). An admin can still preview with ?earthy=1 while it is off for their organisation.
// Delete this file with the old page.

/** Cookie that carries an admin's ?earthy=1 / ?earthy=0 choice, so the layout (which cannot see search params) agrees with the page. */
export const EARTHY_COOKIE = "earthy_preview";

export function earthyEnabled(
  orgId: string,
  opts: { env?: string | undefined; previewParam?: string | undefined; isAdmin?: boolean } = {},
): boolean {
  const env = (opts.env ?? process.env.EARTHY_DASHBOARD_ORGS ?? "").trim();
  if (opts.isAdmin === true && opts.previewParam === "0") return false;
  if (env === "" || env === "*") return true;
  if (env.split(",").map((s) => s.trim()).filter(Boolean).includes(orgId)) return true;
  return opts.isAdmin === true && opts.previewParam === "1";
}
