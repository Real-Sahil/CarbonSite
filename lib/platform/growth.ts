/**
 * Go-to-market numbers for the platform team: trials started, trials that
 * produced a Carbon Reduction Plan or SECR report (the activation event), and
 * paying organisations, by week and by acquisition source. Pure, so the page
 * and the test share it.
 */
export const PAID_PLANS = ["starter", "growth", "enterprise"] as const;
export const ACTIVATION_REPORT_TYPES = ["ppn_006_crp", "secr"] as const;

export type GrowthOrg = {
  createdAt: Date;
  acquisitionSource: string | null;
  plan: string;
  isPilot: boolean;
  /** Ready ppn_006_crp or secr reports. */
  activationReports: number;
};

export type GrowthRow = { trials: number; activated: number; paying: number };

const isPaying = (o: GrowthOrg) => (PAID_PLANS as readonly string[]).includes(o.plan) && !o.isPilot;

function add(row: GrowthRow, o: GrowthOrg) {
  row.trials += 1;
  if (o.activationReports > 0) row.activated += 1;
  if (isPaying(o)) row.paying += 1;
}

/** Monday 00:00 UTC of the week containing d. */
export function weekStart(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
}

export function growthMetrics(orgs: GrowthOrg[], now: Date, weeks = 12) {
  const thisWeek = weekStart(now);
  const byWeek = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(thisWeek.getTime() - (weeks - 1 - i) * 7 * 86_400_000),
    trials: 0,
    activated: 0,
    paying: 0,
  }));
  const first = byWeek[0].weekStart.getTime();
  const sources = new Map<string, GrowthRow>();
  const total: GrowthRow = { trials: 0, activated: 0, paying: 0 };

  for (const o of orgs) {
    add(total, o);
    const key = o.acquisitionSource ?? "unknown";
    if (!sources.has(key)) sources.set(key, { trials: 0, activated: 0, paying: 0 });
    add(sources.get(key)!, o);
    const t = weekStart(o.createdAt).getTime();
    if (t >= first) {
      const w = byWeek[Math.round((t - first) / (7 * 86_400_000))];
      if (w) add(w, o);
    }
  }

  const bySource = [...sources.entries()]
    .map(([source, r]) => ({ source, ...r }))
    .sort((a, b) => b.trials - a.trials || a.source.localeCompare(b.source));
  return { total, byWeek, bySource, pilots: orgs.filter((o) => o.isPilot).length };
}
