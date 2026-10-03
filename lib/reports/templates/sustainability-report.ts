// Annual sustainability report: one document of what the organisation measured
// and did in a reporting period. It follows how large contractors report:
// headline tiles, a base year / previous / current emissions table with
// intensity, a row for every Scope 3 category, targets with progress,
// measures, waste, social value, assurance, sign-off and an ESRS index. Every
// figure comes from a published snapshot or the organisation's records, and a
// section with no data is left out.

import { esc, brandStyles, brandLogoHtml, svgHBars, svgDonut } from "./shared";
import { change, STANDARD_LABELS } from "@/lib/bids/carbon-pack";
import { ESRS_SECTION_REFS, ESRS_STATEMENT } from "@/lib/sustainability-report/model";
import type { SustainabilityReportData } from "@/lib/sustainability-report/load";

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const fmtT = (n: number | null | undefined) =>
  n == null ? "Not reported" : n.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: n < 10 ? 2 : 1 });
const fmtMoney = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const fmtSignDate = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? fmtDate(new Date(`${s}T00:00:00Z`)) : s);
const fmtChange = (c: number) => `${c <= 0 ? "−" : "+"}${Math.abs(c * 100).toFixed(1)}%`;

const KIND_LABELS = { base: "Base year", previous: "Previous period", current: "Reporting period" } as const;
const STATUS_TEXT = {
  reported: "Reported",
  no_records: "No records in this period",
  not_relevant: "Not relevant (organisation's statement)",
  not_yet_measured: "Not yet measured",
} as const;
const ASSURANCE_STATUS: Record<string, string> = {
  pending_review: "Awaiting review",
  approved: "Approved",
  changes_requested: "Changes requested",
  planning: "Planning",
  fieldwork: "Fieldwork",
  review: "Under review",
  signed: "Opinion signed",
  pending: "Pending",
  rejected: "Rejected",
};

export function renderSustainabilityReportHtml(d: SustainabilityReportData & { logoDataUri?: string }): string {
  const p = d.pack;
  const s12 = p.current.s1 + p.current.s2;
  const baseS12 = p.baseYear?.s1 != null && p.baseYear?.s2 != null ? p.baseYear.s1 + p.baseYear.s2 : null;
  const reduction = change(baseS12, s12); // negative = fell

  const present: string[] = ["emissions"];
  let n = 0;
  const sectionNumbers: Record<string, number> = {};
  const h = (key: string, title: string) => {
    sectionNumbers[key] = ++n;
    return `<h2>${n}. ${esc(title)}</h2>`;
  };

  const about = `
<section>
  ${h("about", "About this report")}
  <p>This report covers <strong>${esc(p.snapshot.periodLabel)}</strong> (${fmtDate(p.snapshot.periodStart)} to ${fmtDate(p.snapshot.periodEnd)}) for ${esc(d.orgName)}. Figures come from published snapshot v${p.snapshot.version}, published ${fmtDate(p.snapshot.publishedAt)}. Published figures cannot be edited; a correction creates a new version.</p>
  <table class="kv">
    <tr><td>Organisational boundary</td><td>${d.boundary ? `${esc(d.boundary.approach)}${d.boundary.sites ? `. Sites: ${esc(d.boundary.sites)}` : ""}` : "Not recorded. Add a Carbon Reduction Plan to state the boundary."}</td></tr>
    ${d.boundary && d.boundary.exclusions.length ? `<tr><td>Exclusions</td><td>${d.boundary.exclusions.map((e) => `${esc(e.item)}${e.reason ? ` (${esc(e.reason)})` : ""}`).join("; ")}</td></tr>` : ""}
    <tr><td>Methodology</td><td>${esc(p.snapshot.methodology)}, GHG Protocol Corporate Standard</td></tr>
    <tr><td>Emission factors</td><td>${esc(p.snapshot.factorLibrary)}</td></tr>
    <tr><td>Global warming potentials</td><td>${esc(p.snapshot.gwpVersion)}</td></tr>
    <tr><td>Activity records</td><td>${p.snapshot.recordCount.toLocaleString("en-GB")}</td></tr>
  </table>
  <p class="note">${esc(ESRS_STATEMENT)}</p>
</section>`;

  const scopeSlices = [
    { label: "Scope 1", value: p.current.s1 * 1000, scope: 1 },
    { label: "Scope 2 (location-based)", value: p.current.s2 * 1000, scope: 2 },
    { label: "Scope 3", value: p.current.s3 * 1000, scope: 3 },
  ].filter((s) => s.value > 0);
  const topCats = p.categories.slice(0, 8).map((c) => ({ label: c.name, value: c.tonnes * 1000, scope: c.scope }));

  const emissions = `
<section>
  ${h("emissions", "Greenhouse gas emissions")}
  <table>
    <tr><th>Emissions (tCO₂e)</th><th></th><th class="num">Scope 1</th><th class="num">Scope 2</th><th class="num">Scope 3</th><th class="num">Total</th></tr>
    ${d.years
      .map(
        (r) =>
          `<tr><td>${esc(r.label)}</td><td class="muted">${KIND_LABELS[r.kind]}</td><td class="num">${fmtT(r.s1)}</td><td class="num">${fmtT(r.s2)}</td><td class="num">${fmtT(r.s3)}</td><td class="num"><strong>${fmtT(r.total)}</strong></td></tr>`,
      )
      .join("")}
  </table>
  ${p.current.s2Market != null ? `<p class="note">Scope 2 is location-based. Market-based Scope 2, shown beside the total and not added to it: ${fmtT(p.current.s2Market)} tCO₂e.</p>` : ""}
  ${
    reduction != null && p.baseYear
      ? `<p>Scope 1 and 2 emissions are <strong>${fmtChange(reduction)}</strong> against the ${esc(p.baseYear.label)} (${fmtT(baseS12)} to ${fmtT(s12)} tCO₂e).</p>`
      : `<p class="muted">No base year is set, so no change against a baseline is shown.</p>`
  }
  ${
    d.intensity
      ? `<h3>Carbon intensity</h3>
  <table>
    <tr><th>Measure</th><th class="num">${esc(p.snapshot.periodLabel)}</th></tr>
    <tr><td>tCO₂e per million ${esc(d.intensity.currency)} revenue (all scopes)</td><td class="num">${fmtT(d.intensity.perMillionTotal)}</td></tr>
    <tr><td>tCO₂e per million ${esc(d.intensity.currency)} revenue (Scope 1 and 2)</td><td class="num">${fmtT(d.intensity.perMillionS12)}</td></tr>
    ${d.intensity.perFte != null ? `<tr><td>tCO₂e per full-time employee (all scopes)</td><td class="num">${fmtT(d.intensity.perFte)}</td></tr>` : ""}
  </table>
  <p class="note">Revenue and headcount are the figures entered for this reporting period.</p>`
      : `<p class="muted">Intensity is not shown: no revenue is entered for this reporting period.</p>`
  }
  ${scopeSlices.length ? `<h3>Split by scope</h3>${svgDonut(scopeSlices, { title: "Total" })}` : ""}
  ${topCats.length ? `<h3>Largest sources</h3>${svgHBars(topCats)}` : ""}
</section>`;

  const scope3 = `
<section>
  ${h("scope3", "Scope 3 categories")}
  <p>Every GHG Protocol Scope 3 category is listed. A category with no records is shown as such; only the organisation can state that a category is not relevant to it.</p>
  <table>
    <tr><th>Category</th><th class="num">tCO₂e</th><th>Status</th><th>Explanation</th></tr>
    ${d.scope3
      .map(
        (r) =>
          `<tr><td>${esc(r.label)}</td><td class="num">${r.tonnes != null ? fmtT(r.tonnes) : "–"}</td><td>${STATUS_TEXT[r.status]}</td><td>${esc(r.explanation)}</td></tr>`,
      )
      .join("")}
  </table>
</section>`;

  const interim = p.interimTargets;
  const hasTargets = p.netZeroYear != null || interim.length > 0 || p.targets.length > 0;
  if (hasTargets) present.push("targets");
  const targets = hasTargets
    ? `
<section>
  ${h("targets", "Targets and progress")}
  ${p.netZeroYear != null ? `<p>Net zero commitment: <strong>${p.netZeroYear}</strong>.</p>` : `<p class="muted">No net zero year is recorded.</p>`}
  ${
    interim.length
      ? `<table><tr><th>Target year</th><th>Target</th><th>Scopes</th><th class="num">Reduction so far</th></tr>${interim
          .map(
            (it) =>
              `<tr><td>${it.year}</td><td>${it.reductionPct}% reduction against the ${esc(p.baseYear?.label ?? "baseline")}</td><td>${esc(it.description ?? "Scopes 1 and 2")}</td><td class="num">${reduction != null ? fmtChange(reduction) : "No baseline"}</td></tr>`,
          )
          .join("")}</table>
  <p class="note">Reduction so far is Scope 1 and 2 in this period against the base year.</p>`
      : ""
  }
  ${
    p.targets.length
      ? `<table><tr><th>Type</th><th>From</th><th>To</th><th class="num">Reduction (tCO₂e)</th></tr>${p.targets
          .map(
            (tg) =>
              `<tr><td>${tg.type === "absolute" ? "Absolute" : "Intensity"}</td><td>${esc(tg.baselineLabel)}</td><td>${esc(tg.targetLabel)}</td><td class="num">${fmtT(tg.reductionTonnes)}</td></tr>`,
          )
          .join("")}</table>`
      : ""
  }
</section>`
    : "";

  const done = p.initiatives.filter((i) => i.status === "complete");
  const next = p.initiatives.filter((i) => i.status !== "complete");
  if (p.initiatives.length) present.push("measures");
  const measureTable = (rows: typeof p.initiatives) =>
    `<table><tr><th>Measure</th><th class="num">Expected saving (tCO₂e/yr)</th></tr>${rows
      .map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${i.expectedTonnes != null ? fmtT(i.expectedTonnes) : "Not estimated"}</td></tr>`)
      .join("")}</table>`;
  const measures = p.initiatives.length
    ? `
<section>
  ${h("measures", "Reduction measures")}
  ${done.length ? `<h3>Completed</h3>${measureTable(done)}` : ""}
  ${next.length ? `<h3>In progress and planned</h3>${measureTable(next)}` : ""}
</section>`
    : "";

  if (d.waste) present.push("waste");
  const waste = d.waste
    ? `
<section>
  ${h("waste", "Waste")}
  <table>
    <tr><td>Waste recorded</td><td class="num">${fmtT(d.waste.totalTonnes)} tonnes</td></tr>
    <tr><td>Diverted from landfill</td><td class="num">${fmtT(d.waste.divertedTonnes)} tonnes</td></tr>
    <tr><td>Diversion rate</td><td class="num">${d.waste.diversionRate != null ? `${(d.waste.diversionRate * 100).toFixed(1)}%` : "Not reported"}</td></tr>
  </table>
</section>`
    : "";

  if (d.socialValue) present.push("social");
  const social = d.socialValue
    ? `
<section>
  ${h("social", "Social value")}
  <p>National TOMs social value recorded in ${esc(p.snapshot.periodLabel)}: <strong>${fmtMoney(d.socialValue.totalPounds)}</strong>.</p>
  ${
    d.socialValue.byTheme.length
      ? `<table><tr><th>Theme</th><th class="num">Value</th></tr>${d.socialValue.byTheme.map((t) => `<tr><td>${esc(t.name)}</td><td class="num">${fmtMoney(t.pounds)}</td></tr>`).join("")}</table>`
      : ""
  }
</section>`
    : "";

  const e = p.assurance.engagement;
  const assurance = `
<section>
  ${h("assurance", "Data quality and assurance")}
  <table class="kv">
    <tr><td>Internal review</td><td>${ASSURANCE_STATUS[p.snapshot.reviewStatus] ?? esc(p.snapshot.reviewStatus)}</td></tr>
    <tr><td>Auditor sign-off</td><td>${p.assurance.auditorSignOff ? `${ASSURANCE_STATUS[p.assurance.auditorSignOff.status] ?? esc(p.assurance.auditorSignOff.status)}${p.assurance.auditorSignOff.signedAt ? `, ${fmtDate(p.assurance.auditorSignOff.signedAt)}` : ""}` : "None"}</td></tr>
    <tr><td>Independent assurance</td><td>${e ? `${esc(e.provider)}, ${esc(e.level)} assurance under ${STANDARD_LABELS[e.standard] ?? esc(e.standard)}: ${ASSURANCE_STATUS[e.status] ?? esc(e.status)}${e.opinionIssuedAt ? ` (${fmtDate(e.opinionIssuedAt)})` : ""}` : "None"}</td></tr>
  </table>
  <p class="note">Each activity record carries its source unit, factor, formula and selection reason in the calculation trail that accompanies this report.</p>
</section>`;

  const sig = p.signatory;
  const signoff = `
<section>
  ${h("signoff", "Sign-off")}
  <table class="kv sign">
    <tr><td>Signed on behalf of ${esc(d.orgName)}</td><td>${sig.name ? esc(sig.name) : ""}</td></tr>
    <tr><td>Position</td><td>${sig.title ? esc(sig.title) : ""}</td></tr>
    <tr><td>Date</td><td>${sig.date ? esc(fmtSignDate(sig.date)) : ""}</td></tr>
  </table>
</section>`;

  const esrs = `
<section>
  ${h("esrs", "ESRS index")}
  <table>
    <tr><th>Disclosure</th><th>Section</th></tr>
    ${present
      .map((key) => {
        const num = sectionNumbers[key];
        return `<tr><td>${esc(ESRS_SECTION_REFS[key])}</td><td>${num ? `Section ${num}` : ""}</td></tr>`;
      })
      .join("")}
  </table>
</section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sustainability report ${esc(p.snapshot.periodLabel)}, ${esc(d.orgName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1b2328; line-height: 1.5 }
  .cover { background: #16323d; color: #fff; padding: 44px 40px 36px }
  .cover .kicker { font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; margin-top: 14px }
  .cover h1 { font-size: 24pt; font-weight: 700; margin: 4px 0 6px; letter-spacing: -0.01em }
  .cover .meta { font-size: 9pt; opacity: 0.7; margin-top: 18px }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 24px 40px 0 }
  .tile { border: 1px solid #d5e1e3; border-radius: 6px; padding: 12px }
  .tile .val { font-size: 16pt; font-weight: 700; color: #16323d; display: block; font-variant-numeric: tabular-nums }
  .tile .lbl { font-size: 8.5pt; color: #4b5d63 }
  section { margin: 26px 40px }
  h2 { font-size: 13pt; font-weight: 700; color: #16323d; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 2px solid #16323d }
  h3 { font-size: 10.5pt; font-weight: 700; color: #16323d; margin: 16px 0 6px }
  p { margin-bottom: 6px; max-width: 170mm }
  .muted { color: #5b6b70; font-size: 9pt }
  .note { color: #4b5d63; font-size: 8.5pt }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 6px 0 10px }
  th { background: #e9f1f2; color: #16323d; text-align: left; padding: 5px 8px; border: 1px solid #cddcdf }
  td { padding: 5px 8px; border: 1px solid #dde6e8; vertical-align: top }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap }
  table.kv td:first-child { width: 34%; color: #4b5d63 }
  table.sign td:last-child { height: 28px }
  footer { font-size: 8pt; color: #6b7a7f; text-align: center; padding: 18px; border-top: 1px solid #dde6e8; margin-top: 30px }
  ${brandStyles()}
</style>
</head>
<body>

<div class="cover">
  ${brandLogoHtml(d.logoDataUri)}
  <p class="kicker">Sustainability report</p>
  <h1>${esc(d.orgName)}</h1>
  <p class="meta">${esc(p.snapshot.periodLabel)} · Snapshot v${p.snapshot.version} · Published ${fmtDate(p.snapshot.publishedAt)}</p>
</div>

<div class="tiles">
  ${d.tiles.map((t) => `<div class="tile"><span class="val">${esc(t.value)}</span><span class="lbl">${esc(t.label)}</span></div>`).join("")}
</div>

${about}
${emissions}
${scope3}
${targets}
${measures}
${waste}
${social}
${assurance}
${signoff}
${esrs}

<footer>${esc(d.orgName)} · Sustainability report · Figures from published snapshot v${p.snapshot.version} (${esc(p.snapshot.periodLabel)})</footer>
</body>
</html>`;
}
