/**
 * Site Waste Management Plan (SWMP). One living plan per project: who is responsible, a forecast of
 * the waste expected and where it should go, a diversion target, the actions to reduce waste, and a
 * review date. England's statutory SWMP duty was repealed, but clients, BREEAM and many tenders still
 * ask for one, so the plan is kept as a record the team owns. The platform never says a plan is
 * compliant; it says what is missing (`swmpChecks()`) and sets the forecast beside the actual waste.
 */
import { z } from "zod";
import { formatEwc, normaliseEwc } from "./duty-of-care";
import { wasteHierarchyOf } from "./hierarchy";

export const PLAN_ROUTES = ["reuse", "recycle", "recovery", "landfill"] as const;
export type PlanRoute = (typeof PLAN_ROUTES)[number];
export const ROUTE_LABEL: Record<PlanRoute, string> = { reuse: "Reuse on or off site", recycle: "Recycle", recovery: "Energy recovery", landfill: "Landfill" };

export const planLineSchema = z.object({
  wasteType: z.string().trim().min(1).max(100),
  ewcCode: z.string().trim().max(20).nullish(),
  forecastTonnes: z.number().min(0).max(10_000_000),
  plannedRoute: z.enum(PLAN_ROUTES),
});
export const wastePlanLinesSchema = z.array(planLineSchema).max(100);
export type PlanLine = z.infer<typeof planLineSchema>;

const text = (n: number) => z.string().trim().max(n).nullish();
export const wastePlanSchema = z
  .object({
    responsiblePerson: text(160),
    principalContractor: text(160),
    clientName: text(160),
    targetDiversionPct: z.number().min(0).max(100).nullish(),
    actions: text(4000),
    nextReviewOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    lines: wastePlanLinesSchema.default([]),
  })
  .strict();

export type PlanCheck = { key: string; ok: boolean; label: string };

/** What a reader of the plan would look for. Nothing here claims the plan is adequate or lawful. */
export function swmpChecks(p: {
  responsiblePerson?: string | null;
  principalContractor?: string | null;
  targetDiversionPct?: number | null;
  actions?: string | null;
  nextReviewOn?: string | null;
  lines: PlanLine[];
}): PlanCheck[] {
  const badEwc = p.lines.filter((l) => l.ewcCode && !normaliseEwc(l.ewcCode)).length;
  return [
    { key: "person", ok: !!p.responsiblePerson?.trim(), label: "A named person responsible for the plan" },
    { key: "contractor", ok: !!p.principalContractor?.trim(), label: "The principal contractor" },
    { key: "forecast", ok: p.lines.length > 0 && p.lines.some((l) => l.forecastTonnes > 0), label: "A forecast of the waste expected, by type" },
    { key: "ewc", ok: badEwc === 0, label: badEwc ? `${badEwc} forecast line${badEwc === 1 ? "" : "s"} with an EWC code that is not on the List of Waste` : "EWC codes on the List of Waste" },
    { key: "target", ok: p.targetDiversionPct != null, label: "A target for waste diverted from landfill" },
    { key: "actions", ok: !!p.actions?.trim(), label: "Actions to reduce waste and landfill" },
    { key: "review", ok: !!p.nextReviewOn, label: "A date to review the plan" },
  ];
}

export type Actual = { wasteType: string; ewcCode: string | null; route: string; tonnes: number };
export type ForecastRow = PlanLine & { actualTonnes: number; varianceTonnes: number };

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Each actual record goes to the forecast line with the same EWC code, else the same waste type
 * (case-insensitive); the rest are "not in the forecast", so nothing is dropped.
 */
export function compareToForecast(lines: PlanLine[], actuals: Actual[]) {
  const rows: ForecastRow[] = lines.map((l) => ({ ...l, actualTonnes: 0, varianceTonnes: 0 }));
  let unplanned = 0;
  for (const a of actuals) {
    const ewc = normaliseEwc(a.ewcCode);
    const hit = rows.find((r) => (ewc && normaliseEwc(r.ewcCode ?? null) === ewc) || norm(r.wasteType) === norm(a.wasteType));
    if (hit) hit.actualTonnes += a.tonnes;
    else unplanned += a.tonnes;
  }
  for (const r of rows) r.varianceTonnes = r.actualTonnes - r.forecastTonnes;
  const forecastTotal = lines.reduce((t, l) => t + l.forecastTonnes, 0);
  const actualTotal = actuals.reduce((t, a) => t + a.tonnes, 0);
  const divertedActual = actuals.filter((a) => wasteHierarchyOf(a.route) !== "landfill").reduce((t, a) => t + a.tonnes, 0);
  const divertedPlanned = lines.filter((l) => l.plannedRoute !== "landfill").reduce((t, l) => t + l.forecastTonnes, 0);
  return {
    rows,
    unplannedTonnes: unplanned,
    forecastTotal,
    actualTotal,
    plannedDiversionPct: forecastTotal > 0 ? (divertedPlanned / forecastTotal) * 100 : null,
    actualDiversionPct: actualTotal > 0 ? (divertedActual / actualTotal) * 100 : null,
  };
}

export const prettyEwc = (code: string | null | undefined) => {
  const n = normaliseEwc(code ?? null);
  return n ? formatEwc(n) : (code ?? "");
};
