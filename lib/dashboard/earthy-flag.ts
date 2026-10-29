// Rollout switch for the Executive Summary (docs/design/earthy-tech/implementation_plan.md, phase 0).
// EARTHY_DASHBOARD_ORGS is "*" (everyone) or a comma-separated list of organisation ids. An admin can also
// preview any organisation they administer with ?earthy=1, so the owner can look before the variable moves.
// Off by default: the current dashboard stays the fallback until sign-off. Delete this file with the old page.

/** Cookie that carries an admin's ?earthy=1 / ?earthy=0 choice, so the layout (which cannot see search params) agrees with the page. */
export const EARTHY_COOKIE = "earthy_preview";

export function earthyEnabled(
  orgId: string,
  opts: { env?: string | undefined; previewParam?: string | undefined; isAdmin?: boolean } = {},
): boolean {
  const env = (opts.env ?? process.env.EARTHY_DASHBOARD_ORGS ?? "").trim();
  if (env === "*") return true;
  if (env.split(",").map((s) => s.trim()).filter(Boolean).includes(orgId)) return true;
  return opts.isAdmin === true && opts.previewParam === "1";
}
