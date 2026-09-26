// Climate transition plan report (ESRS E1-1, UK TPT). Everything comes from
// the organisation's transition plan, targets, initiatives and published
// totals (lib/transition-plan/load.ts); nothing is estimated or written by an
// LLM, and a narrative section left blank in the plan says so rather than
// being filled in.

import { esc, brandStyles, brandLogoHtml } from "./shared";
import { ACA_RATE_1_5C, type PathwayPoint } from "@/lib/transition-plan";
import type { TransitionPlanView } from "@/lib/transition-plan/load";

export type TransitionPlanReportData = TransitionPlanView & {
  orgName: string;
  snapshot: { version: number; periodLabel: string; publishedAt: Date };
  logoDataUri?: string;
};

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fmtT = (n: number | null | undefined) => (n == null ? "–" : n.toLocaleString("en-GB", { maximumFractionDigits: 0 }));
const fmtMoney = (n: number, currency: string) => n.toLocaleString("en-GB", { style: "currency", currency, maximumFractionDigits: 0 });
const STATUS: Record<string, string> = { met: "Done", partial: "Partly", gap: "Missing" };
const LEVER_STATUS: Record<string, string> = { planned: "Planned", in_progress: "In progress", complete: "Completed", canceled: "Cancelled" };

/** Pathway lines as an inline SVG; one scale for every line and label. */
export function pathwaySvg(points: PathwayPoint[]): string {
  if (points.length < 2) return "";
  const W = 640, H = 260, L = 56, R = 12, T = 12, B = 30;
  const max = Math.max(...points.flatMap((p) => [p.reference, p.target ?? 0, p.planned, p.actual ?? 0])) * 1.05 || 1;
  const x0 = points[0].year, x1 = points[points.length - 1].year;
  const x = (y: number) => L + ((y - x0) / (x1 - x0)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = (get: (p: PathwayPoint) => number | null, stroke: string, dash = "") => {
    const pts = points.filter((p) => get(p) != null).map((p) => `${x(p.year).toFixed(1)},${y(get(p)!).toFixed(1)}`);
    return pts.length > 1 ? `<polyline fill="none" stroke="${stroke}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ""} points="${pts.join(" ")}"/>` : "";
  };
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
  const yearStep = Math.max(1, Math.ceil((x1 - x0) / 8));
  const years = points.filter((p) => (p.year - x0) % yearStep === 0).map((p) => p.year);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Decarbonisation pathway" style="font-family:inherit">
  ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e4ecee"/><text x="${L - 6}" y="${y(v) + 3}" font-size="9" text-anchor="end" fill="#5b6b70">${fmtT(v)}</text>`).join("")}
  ${years.map((yr) => `<text x="${x(yr)}" y="${H - 10}" font-size="9" text-anchor="middle" fill="#5b6b70">${yr}</text>`).join("")}
  ${line((p) => p.reference, "#2f8f5b", "5 4")}
  ${line((p) => p.target, "#16323d")}
  ${line((p) => p.planned, "#d9731a")}
  ${points.filter((p) => p.actual != null).map((p) => `<circle cx="${x(p.year)}" cy="${y(p.actual!)}" r="3.5" fill="#2563eb"/>`).join("")}
</svg>
<p class="legend"><span style="color:#2f8f5b">– – 1.5°C benchmark</span> <span style="color:#16323d">— Target</span> <span style="color:#d9731a">— Planned</span> <span style="color:#2563eb">● Published actual</span> <span class="muted">tCO₂e a year</span></p>`;
}

export function renderTransitionPlanHtml(d: TransitionPlanReportData): string {
  const plan = d.plan;
  const g = d.nearTermGap;
  const approved = plan?.status === "approved" && plan.approvedAt;
  const latest = [...d.points].reverse().find((p) => p.actual != null && p.year > (d.base?.year ?? 0));
  const milestones = d.points.filter((p) => p.year === d.base?.year || p.year % 5 === 0 || p.year === g?.year);
  const levers = d.levers.filter((l) => l.status !== "canceled");

  let n = 0;
  const h = (title: string) => `<h2>${++n}. ${esc(title)}</h2>`;
  const narrative = (title: string, text: string | null | undefined) =>
    `<h3>${esc(title)}</h3>${text?.trim() ? text.trim().split(/\n{2,}/).map((para) => `<p>${esc(para)}</p>`).join("") : `<p class="muted">Not yet recorded in the plan.</p>`}`;

  const pathway = `
<section>
  ${h("Pathway")}
  ${
    d.base
      ? `<p>Base: ${esc(d.base.source)}, ${d.base.year}, ${fmtT(d.base.tco2e)} tCO₂e. The 1.5°C benchmark reduces base-year emissions by ${(ACA_RATE_1_5C * 100).toFixed(1)}% of the base each year, to a 90% cut. The planned line takes off each scheduled initiative's annual saving from the year it starts.</p>
  ${pathwaySvg(d.points)}
  <table><tr><th>Year</th><th class="num">1.5°C benchmark</th><th class="num">Target</th><th class="num">Planned</th><th class="num">Published actual</th></tr>${milestones
    .map((p) => `<tr><td>${p.year}</td><td class="num">${fmtT(p.reference)}</td><td class="num">${fmtT(p.target)}</td><td class="num">${fmtT(p.planned)}</td><td class="num">${fmtT(p.actual)}</td></tr>`)
    .join("")}</table>
  ${g ? `<p><strong>${g.gapTco2e > 0 ? `Scheduled initiatives leave ${fmtT(g.gapTco2e)} tCO₂e a year still to find by ${g.year}` : `Scheduled initiatives reach the ${g.against === "target" ? "target" : "1.5°C benchmark"} for ${g.year}`}.</strong></p>` : ""}
  ${d.unscheduled.length ? `<p class="note">Not on the planned line, no start date: ${d.unscheduled.map((l) => esc(l.name)).join(", ")}.</p>` : ""}`
      : `<p class="muted">No SBTi target or active base year, so no pathway can be drawn.</p>`
  }
</section>`;

  const leverSection = `
<section>
  ${h("Decarbonisation levers")}
  ${
    levers.length
      ? `<table><tr><th>Initiative</th><th>Status</th><th>Starts</th><th class="num">Saving (tCO₂e/yr)</th></tr>${levers
          .map((l) => `<tr><td>${esc(l.name)}</td><td>${LEVER_STATUS[l.status] ?? esc(l.status)}</td><td>${l.startYear ?? "Not scheduled"}</td><td class="num">${l.abatementTco2e != null ? fmtT(l.abatementTco2e) : "Not estimated"}</td></tr>`)
          .join("")}</table>`
      : `<p class="muted">No reduction initiatives recorded.</p>`
  }
</section>`;

  const funding = `
<section>
  ${h("Investment and funding")}
  <table>
    <tr><td>Planned capital spend</td><td class="num">${plan?.capexPlanned != null ? fmtMoney(plan.capexPlanned, d.currency) : "Not stated"}</td></tr>
    <tr><td>Planned operating spend</td><td class="num">${plan?.opexPlanned != null ? fmtMoney(plan.opexPlanned, d.currency) : "Not stated"}</td></tr>
    <tr><td>EU Taxonomy-aligned capex</td><td class="num">${plan?.taxonomyAlignedCapexPct != null ? `${plan.taxonomyAlignedCapexPct}%` : "Not applicable or not stated"}</td></tr>
  </table>
</section>`;

  const narrativeSection = `
<section>
  ${h("The plan")}
  ${narrative("Ambition", plan?.ambition)}
  ${narrative("Strategy and financial planning", plan?.strategy)}
  ${narrative("Locked-in emissions", plan?.lockedInEmissions)}
  ${narrative("Engagement", plan?.engagement)}
  ${narrative("Governance", plan?.governance)}
</section>`;

  const checklist = `
<section class="page-break">
  ${h("ESRS E1-1 checklist")}
  <table><tr><th>Element</th><th>Reference</th><th>Status</th><th>Detail</th></tr>${d.checklist
    .map((c) => `<tr><td>${esc(c.label)}</td><td>${esc(c.code)}</td><td class="st-${c.status}">${STATUS[c.status]}</td><td>${esc(c.detail)}</td></tr>`)
    .join("")}</table>
</section>`;

  const approval = `
<section>
  ${h("Approval")}
  <p>${
    approved
      ? `Approved by ${esc(plan!.approvalBody ?? "the board")} on ${fmtDate(plan!.approvedAt!)}.`
      : "This plan has not been approved by the administrative, management or supervisory body. It is a draft."
  }</p>
  <p class="note">Emissions figures: published snapshot v${d.snapshot.version} (${esc(d.snapshot.periodLabel)}, published ${fmtDate(d.snapshot.publishedAt)}) and earlier published periods. Location-based Scope 2.</p>
</section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Climate transition plan, ${esc(d.orgName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1b2328; line-height: 1.5 }
  .cover { background: #16323d; color: #fff; padding: 44px 40px 36px }
  .cover .kicker { font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; margin-top: 14px }
  .cover h1 { font-size: 22pt; font-weight: 700; margin: 4px 0 6px }
  .cover .meta { font-size: 9pt; opacity: 0.75; margin-top: 14px }
  .draft { display: inline-block; margin-top: 10px; padding: 2px 10px; border: 1px solid #f3c27a; color: #f3c27a; border-radius: 12px; font-size: 9pt }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 24px 40px 0 }
  .kpi { border: 1px solid #d5e1e3; border-radius: 6px; padding: 12px }
  .kpi .val { font-size: 15pt; font-weight: 700; color: #16323d; display: block; font-variant-numeric: tabular-nums }
  .kpi .lbl { font-size: 8.5pt; color: #4b5d63 }
  section { margin: 26px 40px }
  h2 { font-size: 13pt; font-weight: 700; color: #16323d; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 2px solid #16323d }
  h3 { font-size: 10.5pt; font-weight: 700; color: #16323d; margin: 14px 0 6px }
  p { margin-bottom: 6px; max-width: 170mm }
  .muted { color: #5b6b70; font-size: 9pt }
  .note { color: #4b5d63; font-size: 8.5pt }
  .legend { font-size: 8.5pt; display: flex; gap: 14px; flex-wrap: wrap }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 6px 0 10px }
  th { background: #e9f1f2; color: #16323d; text-align: left; padding: 5px 8px; border: 1px solid #cddcdf }
  td { padding: 5px 8px; border: 1px solid #dde6e8; vertical-align: top }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap }
  .st-met { color: #1d6b3f; font-weight: 700 } .st-partial { color: #9a5b00; font-weight: 700 } .st-gap { color: #b42318; font-weight: 700 }
  footer { font-size: 8pt; color: #6b7a7f; text-align: center; padding: 18px; border-top: 1px solid #dde6e8; margin-top: 30px }
  ${brandStyles()}
</style>
</head>
<body>
<div class="cover">
  ${brandLogoHtml(d.logoDataUri)}
  <p class="kicker">Climate transition plan</p>
  <h1>${esc(d.orgName)}</h1>
  <p class="meta">ESRS E1-1 · UK Transition Plan Taskforce framework${plan?.netZeroYear ? ` · Net zero by ${plan.netZeroYear}` : ""}</p>
  ${approved ? `<p class="meta">Approved by ${esc(plan!.approvalBody ?? "the board")}, ${fmtDate(plan!.approvedAt!)}</p>` : `<span class="draft">Draft, not yet approved</span>`}
</div>
<div class="kpis">
  <div class="kpi"><span class="val">${d.base ? fmtT(d.base.tco2e) : "–"}</span><span class="lbl">tCO₂e base${d.base ? `, ${d.base.year}` : ""}</span></div>
  <div class="kpi"><span class="val">${latest ? fmtT(latest.actual) : "–"}</span><span class="lbl">tCO₂e published${latest ? `, ${latest.year}` : ""}</span></div>
  <div class="kpi"><span class="val">${g ? fmtT(g.goal) : "–"}</span><span class="lbl">tCO₂e ${g?.against === "target" ? "target" : "1.5°C benchmark"}${g ? `, ${g.year}` : ""}</span></div>
  <div class="kpi"><span class="val">${g ? (g.gapTco2e > 0 ? fmtT(g.gapTco2e) : "0") : "–"}</span><span class="lbl">tCO₂e a year still to find</span></div>
</div>
${pathway}
${leverSection}
${funding}
${narrativeSection}
${checklist}
${approval}
<footer>${esc(d.orgName)} · Climate transition plan · Figures from published snapshots; initiatives and targets as recorded on ${fmtDate(new Date())}</footer>
</body>
</html>`;
}
