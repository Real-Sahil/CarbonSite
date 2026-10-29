// The Executive Summary's sentences. Each is a pure function of loader output that returns a string,
// or null when an input it needs is missing, so a sentence is never written around a guess. The set
// is closed: greeting, needs-you, glidepath, hotspot, social phase and audit. A bad month is stated
// as flatly as a good one.
import type { GlidepathResult } from "./glidepath";
import { SOCIAL_PHASE_LABEL, type SocialPhase } from "./social-phase";

export type NarrativeFormat = {
  tonnes: (n: number) => string;
  percent: (n: number) => string;
};

export function greeting(i: {
  firstName: string | null;
  hour: number;
  hasData: boolean;
  periodLabel: string | null;
  totalTonnes: number | null;
  changePct: number | null;
  fmt: NarrativeFormat;
}): string {
  const part = i.hour < 12 ? "Good morning" : i.hour < 18 ? "Good afternoon" : "Good evening";
  const hello = i.firstName ? `${part}, ${i.firstName}.` : `${part}.`;
  if (!i.hasData || i.totalTonnes == null || !i.periodLabel) {
    return `${hello} Nothing is recorded yet. Add your first activity data and this page will start to tell you where you stand.`;
  }
  const total = `${i.fmt.tonnes(i.totalTonnes)} recorded for ${i.periodLabel}`;
  if (i.changePct == null) return `${hello} ${total}.`;
  const dir = i.changePct > 0 ? "up" : i.changePct < 0 ? "down" : "level with";
  const tail = i.changePct === 0 ? "the previous period" : `${i.fmt.percent(Math.abs(i.changePct))} on the previous period`;
  return `${hello} ${total}, ${dir} ${tail}.`;
}

export function needsYouLine(i: { pendingSubmissions: number; openReviews: number }): string | null {
  const n = i.pendingSubmissions + i.openReviews;
  if (n <= 0) return null;
  return n === 1 ? "One item needs you." : `${n} items need you.`;
}

export function glidepathLine(g: GlidepathResult | null, fmt: NarrativeFormat): string | null {
  if (!g) return null;
  const gap = fmt.tonnes(Math.abs(g.gapTonnes));
  const basis = g.partial ? " so far this period" : "";
  if (g.status === "on_track") return `On the glidepath to your target${basis}.`;
  return g.status === "behind"
    ? `${gap} behind your glidepath${basis}.`
    : `${gap} ahead of your glidepath${basis}.`;
}

export function hotspotLine(h: { label: string; sharePct: number } | null, fmt: NarrativeFormat): string | null {
  if (!h || !h.label || !(h.sharePct > 0)) return null;
  return `${h.label} is the largest source, ${fmt.percent(h.sharePct)} of the total.`;
}

export function socialPhaseLine(phase: SocialPhase | null): string | null {
  if (!phase) return null;
  return `Social data is at the ${SOCIAL_PHASE_LABEL[phase]} phase.`;
}

/** Wording is ready, partly ready or missing. Never "compliant" or "assured". */
export function auditLine(a: { regimeLabel: string; ready: number; partly: number; total: number } | null): string | null {
  if (!a || a.total <= 0) return null;
  return `${a.ready} of ${a.total} ${a.regimeLabel} datapoints ready, ${a.partly} partly ready.`;
}
