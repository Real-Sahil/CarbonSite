// Which catalogue edition replaces which, without loading the catalogue
// (billing reads it to count a standard once while an organisation holds
// both editions during a transition). Kept in step with `supersedes` on the
// frameworks by catalogue.test.ts.
export const SUPERSEDED_BY: Record<string, string> = {
  "iso-14001-2015": "iso-14001-2026",
  "iso-9001-2015": "iso-9001-2026",
};

/** Adopted framework slugs, counting an old edition not at all while its successor is also adopted. */
export function countedFrameworks(slugs: string[]): string[] {
  const held = new Set(slugs);
  return slugs.filter((s) => !(SUPERSEDED_BY[s] && held.has(SUPERSEDED_BY[s])));
}
