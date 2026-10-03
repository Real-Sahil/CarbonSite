// Project case studies for site noticeboards and bids. A case study is the
// organisation's own account: problem, what was done, the baseline its
// results are measured against, the results and the assumptions behind them.
// Its figures are stated by the organisation, not calculated from records, so
// the board labels them that way and the checks ask for a baseline and the
// assumptions whenever a figure is given. Nothing about a country, currency or
// regulator is built in.

import { z } from "zod";

export const MAX_KPIS = 6;

export const kpiSchema = z.object({
  label: z.string().trim().min(1).max(60),
  /** As the organisation states it: "1.91", "74%", "£7,755". */
  value: z.string().trim().min(1).max(30),
  note: z.string().trim().max(120).default(""),
});
export type Kpi = z.infer<typeof kpiSchema>;

const text = (max: number) => z.string().trim().max(max).default("");

export const caseStudyBody = z.object({
  title: z.string().trim().min(2).max(200),
  contractId: z.string().min(1).nullable().optional().transform((v) => v ?? null),
  problem: text(3000),
  solution: text(3000),
  baseline: text(1000),
  results: text(3000),
  kpis: z.array(kpiSchema).max(MAX_KPIS).default([]),
  assumptions: text(2000),
  published: z.boolean().default(false),
});
export type CaseStudyBody = z.infer<typeof caseStudyBody>;

/** Stored kpis as a clean list; anything malformed is dropped. */
export function parseKpis(raw: unknown): Kpi[] {
  const r = z.array(kpiSchema).safeParse(raw);
  return r.success ? r.data.slice(0, MAX_KPIS) : [];
}

export type Check = { id: string; label: string; ok: boolean; detail: string };

const has = (s: string | null | undefined, min = 10) => !!s && s.trim().length >= min;

/**
 * What a reader needs before trusting a case study. Publishing is allowed
 * either way (the organisation decides), but the board warns when a figure has
 * no baseline or no assumptions behind it.
 */
export function caseStudyChecks(c: Pick<CaseStudyBody, "problem" | "solution" | "baseline" | "results" | "assumptions"> & { kpis: Kpi[] }): Check[] {
  const figures = c.kpis.length > 0;
  return [
    { id: "story", label: "Problem, solution and results", ok: has(c.problem) && has(c.solution) && has(c.results), detail: "Say what the problem was, what was done and what came of it." },
    { id: "baseline", label: "Baseline stated", ok: !figures || has(c.baseline), detail: "Say what the figures are measured against, for example \"a standard diesel generator running the same hours\"." },
    { id: "assumptions", label: "Assumptions stated", ok: !figures || has(c.assumptions), detail: "Say the prices, rates or other assumptions behind the figures." },
  ];
}

export const FIGURES_NOTE = "Figures on this card are stated by the organisation. They are not calculated from its records.";
