import { headingCodes, type CatalogueFramework } from "./catalogue";
import type { RequirementState } from "./readiness";

// The integrated view: clauses that two or more adopted standards share
// (internal audit, management review, competence, ...) side by side, so one
// integrated audit can check them once. IAF MD 11 lets a certification body
// reduce audit time for an integrated system; this shows how integrated it is.

export type IntegratedCell = { code: string; title: string; status: RequirementState; evidence: number };
export type IntegratedRow = { key: string; title: string; cells: Record<string, IntegratedCell>; aligned: boolean };

const clauseOrder = (key: string) => key.replace(/^[a-z]+:/, "").split(".").map((n) => Number(n) || 0);
const compare = (a: string, b: string) => {
  const x = clauseOrder(a);
  const y = clauseOrder(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

export function integratedView(
  frameworks: CatalogueFramework[],
  statuses: Map<string, RequirementState>,
  evidence: Map<string, number>,
): { rows: IntegratedRow[]; sharedShare: number } {
  const rows = new Map<string, IntegratedRow>();
  let assessable = 0;
  let shared = 0;
  const ORDER: RequirementState[] = ["not_started", "in_progress", "implemented"];
  for (const f of frameworks) {
    const headings = headingCodes(f);
    // Assessable requirements under a code (itself when it is not a heading).
    const leaves = (code: string): string[] =>
      headings.has(code) ? f.requirements.filter((r) => r.parent === code).flatMap((r) => leaves(r.code)) : [code];
    for (const r of f.requirements) {
      if (!headings.has(r.code)) assessable++;
      if (!r.sharedKey) continue;
      // A shared heading (ISO 14001's 9.2 internal audit) takes the least advanced state of its clauses.
      const codes = leaves(r.code);
      const states = codes.map((c) => statuses.get(`${f.slug}|${c}`) ?? "not_started");
      const applicable = states.filter((s) => s !== "not_applicable");
      const status: RequirementState = !applicable.length ? "not_applicable" : applicable.reduce((a, b) => (ORDER.indexOf(b) < ORDER.indexOf(a) ? b : a), "implemented" as RequirementState);
      const row = rows.get(r.sharedKey) ?? { key: r.sharedKey, title: r.title, cells: {}, aligned: true };
      row.cells[f.slug] = { code: r.code, title: r.title, status, evidence: codes.reduce((n, c) => n + (evidence.get(`${f.slug}|${c}`) ?? 0), 0) };
      rows.set(r.sharedKey, row);
    }
  }
  const out = [...rows.values()].filter((r) => Object.keys(r.cells).length > 1).sort((a, b) => compare(a.key, b.key));
  for (const r of out) {
    const states = new Set(Object.values(r.cells).map((c) => c.status));
    r.aligned = states.size === 1;
    for (const c of Object.values(r.cells)) {
      const f = frameworks.find((x) => r.cells[x.slug] === c)!;
      const headings = headingCodes(f);
      shared += headings.has(c.code) ? f.requirements.filter((q) => q.parent === c.code).length : 1;
    }
  }
  return { rows: out, sharedShare: assessable ? Math.round((shared / assessable) * 100) : 0 };
}
