// Bid carbon pack: one document for the carbon section of a tender. The
// Carbon Reduction Plan follows the PPN 006 template (baseline, current
// emissions including the five required Scope 3 categories, targets, measures,
// declaration and sign-off), followed by trend, contract evidence, social
// value, assurance and model answers. Sections with no data are omitted.

import { esc, brandStyles, brandLogoHtml, svgHBars } from "./shared";
import { bidAnswers, change, contractAnswer, STANDARD_LABELS, type BidPackData, type ScopeTotals } from "@/lib/bids/carbon-pack";

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const fmtT = (n: number | null | undefined) =>
  n == null ? "Not reported" : n.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: n < 10 ? 2 : 1 });
const fmtMoney = (n: number, currency = "GBP") =>
  n.toLocaleString("en-GB", { style: "currency", currency, maximumFractionDigits: 0 });
const fmtSignDate = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? fmtDate(new Date(`${s}T00:00:00Z`)) : s);
const fmtChange = (c: number | null) => (c == null ? "" : `${c <= 0 ? "−" : "+"}${Math.abs(c * 100).toFixed(1)}%`);

const STATUS_LABELS: Record<string, string> = {
  complete: "Completed",
  in_progress: "In progress",
  planned: "Planned",
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

function scopeRows(label: string, s: ScopeTotals | { s1: number | null; s2: number | null; s3: number | null; total: number | null }) {
  return `<tr><td>${esc(label)}</td><td class="num">${fmtT(s.s1)}</td><td class="num">${fmtT(s.s2)}</td><td class="num">${fmtT(s.s3)}</td><td class="num"><strong>${fmtT(s.total)}</strong></td></tr>`;
}

export function renderBidCarbonPackHtml(d: BidPackData & { logoDataUri?: string }): string {
  const s12 = d.current.s1 + d.current.s2;
  const baseS12 = d.baseYear?.s1 != null && d.baseYear?.s2 != null ? d.baseYear.s1 + d.baseYear.s2 : null;
  const vsBase = change(baseS12, s12);
  const answers = bidAnswers(d);
  const completed = d.initiatives.filter((i) => i.status === "complete");
  const upcoming = d.initiatives.filter((i) => i.status !== "complete");

  let n = 0;
  const h = (title: string) => `<h2>${++n}. ${esc(title)}</h2>`;

  const initiativeTable = (rows: typeof d.initiatives) =>
    rows.length
      ? `<table><tr><th>Measure</th><th>Status</th><th class="num">Expected saving (tCO₂e/yr)</th></tr>${rows
          .map((i) => `<tr><td>${esc(i.name)}</td><td>${STATUS_LABELS[i.status] ?? esc(i.status)}</td><td class="num">${i.expectedTonnes != null ? fmtT(i.expectedTonnes) : "Not estimated"}</td></tr>`)
          .join("")}</table>`
      : `<p class="muted">None recorded.</p>`;

  const crp = `
<section>
  ${h("Carbon Reduction Plan")}
  <p class="lead">Supplier: <strong>${esc(d.orgName)}</strong>. Publication date: ${fmtDate(d.snapshot.publishedAt)}.</p>

  <h3>Commitment to achieving net zero</h3>
  <p>${d.netZeroYear ? `${esc(d.orgName)} is committed to achieving net zero emissions by ${d.netZeroYear}.` : "No net zero year has been recorded. PPN 006 requires a commitment to net zero by 2050 at the latest."}</p>

  <h3>Baseline emissions</h3>
  ${
    d.baseYear
      ? `<p>Baseline year: <strong>${esc(d.baseYear.label)}</strong>. The baseline is the reference point against which emissions reduction is measured.</p>
  <table><tr><th>Emissions (tCO₂e)</th><th class="num">Scope 1</th><th class="num">Scope 2</th><th class="num">Scope 3</th><th class="num">Total</th></tr>${scopeRows(d.baseYear.label, d.baseYear)}</table>`
      : `<p class="muted">No base year has been set.</p>`
  }

  <h3>Current emissions reporting</h3>
  <p>Reporting period: <strong>${esc(d.snapshot.periodLabel)}</strong> (${fmtDate(d.snapshot.periodStart)} to ${fmtDate(d.snapshot.periodEnd)}).</p>
  <table><tr><th>Emissions (tCO₂e)</th><th class="num">Scope 1</th><th class="num">Scope 2</th><th class="num">Scope 3</th><th class="num">Total</th></tr>${scopeRows(d.snapshot.periodLabel, d.current)}</table>
  ${d.current.s2Market != null ? `<p class="note">Scope 2 is location-based. Market-based Scope 2, reported alongside and not added to the total: ${fmtT(d.current.s2Market)} tCO₂e.</p>` : ""}
  <table><tr><th>Required Scope 3 category</th><th class="num">tCO₂e</th></tr>${d.ppnScope3
    .map((c) => `<tr><td>${esc(c.label)}</td><td class="num">${c.tonnes != null ? fmtT(c.tonnes) : "Not reported"}</td></tr>`)
    .join("")}</table>

  <h3>Emissions reduction targets</h3>
  ${
    d.interimTargets.length
      ? `<table><tr><th>Target year</th><th>Target</th><th>Scopes</th></tr>${d.interimTargets
          .map((it) => `<tr><td>${it.year}</td><td>${it.reductionPct}% reduction against the ${esc(d.baseYear?.label ?? "baseline")}</td><td>${esc(it.description ?? "Scopes 1 and 2")}</td></tr>`)
          .join("")}</table>`
      : ""
  }
  ${
    d.targets.length
      ? `<table><tr><th>Type</th><th>From</th><th>To</th><th class="num">Reduction (tCO₂e)</th><th class="num">Share of baseline</th></tr>${d.targets
          .map(
            (tg) =>
              `<tr><td>${tg.type === "absolute" ? "Absolute" : "Intensity"}</td><td>${esc(tg.baselineLabel)}</td><td>${esc(tg.targetLabel)}</td><td class="num">${fmtT(tg.reductionTonnes)}</td><td class="num">${tg.baselineTonnes ? `${((tg.reductionTonnes / tg.baselineTonnes) * 100).toFixed(1)}%` : ""}</td></tr>`,
          )
          .join("")}</table>`
      : d.interimTargets.length
        ? ""
        : `<p class="muted">No interim targets recorded beyond the net zero commitment.</p>`
  }

  <h3>Carbon reduction projects</h3>
  <p><strong>Completed</strong></p>
  ${initiativeTable(completed)}
  <p><strong>In progress and planned</strong></p>
  ${initiativeTable(upcoming)}

  <h3>Declaration and sign-off</h3>
  <p>This Carbon Reduction Plan has been completed in accordance with PPN 006 and associated guidance and reporting standard for Carbon Reduction Plans.</p>
  <p>Emissions have been reported and recorded in accordance with the published reporting standard for Carbon Reduction Plans and the GHG Reporting Protocol corporate standard, and use the appropriate government emission conversion factors for greenhouse gas company reporting (${esc(d.snapshot.factorLibrary)}).</p>
  <p>Scope 1 and Scope 2 emissions have been reported in accordance with SECR requirements, and the required subset of Scope 3 emissions has been reported in accordance with the published reporting standard for Carbon Reduction Plans and the Corporate Value Chain (Scope 3) Standard.</p>
  <p>This Carbon Reduction Plan has been reviewed and signed off by the board of directors (or equivalent management body).</p>
  <table class="sign">
    <tr><td>Signed on behalf of the supplier</td><td>${d.signatory.name ? esc(d.signatory.name) : "&nbsp;"}</td></tr>
    <tr><td>Position</td><td>${d.signatory.title ? esc(d.signatory.title) : "&nbsp;"}</td></tr>
    <tr><td>Date</td><td>${d.signatory.date ? esc(fmtSignDate(d.signatory.date)) : "&nbsp;"}</td></tr>
  </table>
</section>`;

  const trend =
    d.history.length >= 2
      ? `
<section class="page-break">
  ${h("Emissions trend")}
  <p>Latest published snapshot for each reporting period, in tCO₂e. Scope 2 is location-based. The chart shows Scope 1 and 2.</p>
  <table><tr><th>Period</th><th class="num">Scope 1</th><th class="num">Scope 2</th><th class="num">Scope 3</th><th class="num">Total</th><th class="num">Scope 1+2 change</th></tr>${d.history
    .map((p, i) => {
      const prev = d.history[i - 1];
      const c = prev ? change(prev.totals.s1 + prev.totals.s2, p.totals.s1 + p.totals.s2) : null;
      return `<tr><td>${esc(p.periodLabel)} <span class="muted">v${p.snapshotVersion}</span></td><td class="num">${fmtT(p.totals.s1)}</td><td class="num">${fmtT(p.totals.s2)}</td><td class="num">${fmtT(p.totals.s3)}</td><td class="num"><strong>${fmtT(p.totals.total)}</strong></td><td class="num">${fmtChange(c)}</td></tr>`;
    })
    .join("")}</table>
  ${svgHBars(
    d.history.map((p) => ({ label: p.periodLabel, value: (p.totals.s1 + p.totals.s2) * 1000, color: "#1f4e5f" })),
    { unit: "t" },
  )}
</section>`
      : "";

  const categories = d.categories.length
    ? `
<section>
  ${h("Where our emissions come from")}
  <table><tr><th>Scope</th><th>Category</th><th class="num">tCO₂e</th><th class="num">Share</th></tr>${d.categories
    .slice(0, 12)
    .map(
      (c) =>
        `<tr><td>${c.scope}</td><td>${esc(c.name)}</td><td class="num">${fmtT(c.tonnes)}</td><td class="num">${d.current.total > 0 ? ((c.tonnes / d.current.total) * 100).toFixed(1) : "0.0"}%</td></tr>`,
    )
    .join("")}</table>
</section>`
    : "";

  const contracts = d.contracts.length
    ? `
<section class="page-break">
  ${h("Contract delivery evidence")}
  <p>Emissions recorded against each contract in ${esc(d.snapshot.periodLabel)}, calculated with the same method as the corporate inventory. Waste is to date; social value covers reporting periods up to the end of ${esc(d.snapshot.periodLabel)}, against the contract's National TOMs commitment.</p>
  ${d.contracts
    .map(
      (c) => `
  <div class="contract">
    <h3>${esc(c.name)}</h3>
    <p class="muted">${[c.client, c.reference, c.startDate ? `${fmtDate(c.startDate)}${c.endDate ? ` to ${fmtDate(c.endDate)}` : ""}` : null].filter(Boolean).map((s) => esc(s as string)).join(" · ")}</p>
    <table>
      ${c.value != null ? `<tr><td>Contract value</td><td class="num">${fmtMoney(c.value, c.currency)}</td></tr>` : ""}
      <tr><td>Emissions in period</td><td class="num">${fmtT(c.tonnes)} tCO₂e</td></tr>
      ${c.tonnesPerMillion != null ? `<tr><td>Carbon intensity</td><td class="num">${fmtT(c.tonnesPerMillion)} tCO₂e per £1m</td></tr>` : ""}
      ${c.budgetTonnes != null ? `<tr><td>Carbon budget</td><td class="num">${fmtT(c.budgetTonnes)} tCO₂e</td></tr>` : ""}
      ${c.wasteTonnes > 0 ? `<tr><td>Waste handled</td><td class="num">${fmtT(c.wasteTonnes)} t, ${((c.diversionRate ?? 0) * 100).toFixed(0)}% diverted from landfill</td></tr>` : ""}
      ${c.socialValue.targetPounds != null ? `<tr><td>Social value committed (TOMs)</td><td class="num">${fmtMoney(c.socialValue.targetPounds)}</td></tr>` : ""}
      ${c.socialValuePounds > 0 ? `<tr><td>Social value delivered (TOMs)</td><td class="num">${fmtMoney(c.socialValuePounds)}${c.socialValue.targetPounds ? `, ${Math.round((c.socialValuePounds / c.socialValue.targetPounds) * 100)}% of commitment` : ""}</td></tr>` : ""}
      ${c.socialValue.themes.map((th) => `<tr><td class="indent">${esc(th.code)} ${esc(th.name)}</td><td class="num">${fmtMoney(th.pounds)}</td></tr>`).join("")}
    </table>
    ${
      c.socialValue.measures.length
        ? `<table>
      <tr><th>Largest TOMs measures</th><th class="num">Quantity</th><th class="num">Value</th></tr>
      ${c.socialValue.measures.map((m) => `<tr><td>${esc(m.code)} ${esc(m.name)}</td><td class="num">${m.unit === "£" ? fmtMoney(m.quantity) : `${m.quantity.toLocaleString("en-GB", { maximumFractionDigits: 1 })} ${esc(m.unit)}`}</td><td class="num">${fmtMoney(m.pounds)}</td></tr>`).join("")}
    </table>`
        : ""
    }
    ${
      c.ppn026?.length
        ? `<table>
      <tr><th>PPN 026 KPIs (Good Jobs and Skills)</th><th class="num">Target</th><th class="num">Delivered</th><th class="num">Evidenced</th></tr>
      ${c.ppn026.map((k) => `<tr><td>${esc(k.title)}</td><td class="num">${k.target != null ? `${k.target.toLocaleString("en-GB", { maximumFractionDigits: 1 })} ${esc(k.unit ?? "")}` : "-"}</td><td class="num">${k.delivered.toLocaleString("en-GB", { maximumFractionDigits: 1 })}${k.progressPct != null ? ` (${k.progressPct}%)` : ""}</td><td class="num">${k.entriesWithEvidence} of ${k.approvedEntries}</td></tr>`).join("")}
    </table>`
        : ""
    }
    <div class="answer"><p class="muted">Answer for this contract</p><p>${esc(contractAnswer(c, d.snapshot.periodLabel))}</p></div>
  </div>`,
    )
    .join("")}
</section>`
    : "";

  const social =
    d.socialValuePounds > 0
      ? `
<section>
  ${h("Social value")}
  <p>Social value recorded against National TOMs measures across all contracts in ${esc(d.snapshot.periodLabel)}: <strong>${fmtMoney(d.socialValuePounds)}</strong>. ${d.contracts.some((c) => c.socialValuePounds > 0) ? "Featured contracts are broken down by TOMs theme and measure under Contract delivery evidence." : "Contract-level National TOMs reports are available on request."}</p>
</section>`
      : "";

  const e = d.assurance.engagement;
  const assurance = `
<section>
  ${h("Data quality and assurance")}
  <table>
    <tr><td>Published snapshot</td><td>v${d.snapshot.version}, published ${fmtDate(d.snapshot.publishedAt)} by ${esc(d.snapshot.publishedBy)}. Published figures cannot be edited; a correction creates a new version.</td></tr>
    <tr><td>Internal review</td><td>${STATUS_LABELS[d.snapshot.reviewStatus] ?? esc(d.snapshot.reviewStatus)}</td></tr>
    <tr><td>Auditor sign-off</td><td>${d.assurance.auditorSignOff ? `${STATUS_LABELS[d.assurance.auditorSignOff.status] ?? esc(d.assurance.auditorSignOff.status)}${d.assurance.auditorSignOff.signedAt ? `, ${fmtDate(d.assurance.auditorSignOff.signedAt)}` : ""}` : "None"}</td></tr>
    <tr><td>Independent assurance</td><td>${e ? `${esc(e.provider)}, ${esc(e.level)} assurance under ${STANDARD_LABELS[e.standard] ?? esc(e.standard)}: ${STATUS_LABELS[e.status] ?? esc(e.status)}${e.opinionIssuedAt ? ` (${fmtDate(e.opinionIssuedAt)})` : ""}` : "None"}</td></tr>
    <tr><td>Methodology</td><td>${esc(d.snapshot.methodology)}, GHG Protocol Corporate Standard, operational control</td></tr>
    <tr><td>Emission factors</td><td>${esc(d.snapshot.factorLibrary)}</td></tr>
    <tr><td>Global warming potentials</td><td>${esc(d.snapshot.gwpVersion)}</td></tr>
    <tr><td>Activity records</td><td>${d.snapshot.recordCount.toLocaleString("en-GB")}, each with its source unit, factor, formula and selection reason</td></tr>
  </table>
</section>`;

  const qa = answers.length
    ? `
<section>
  ${h("Model answers")}
  <p class="muted">Draft answers to common tender questions, using only the figures in this pack. Adapt them to the question's wording and word limit.</p>
  ${answers.map((a) => `<div class="qa"><p class="q">${esc(a.question)}</p><p>${esc(a.answer)}</p></div>`).join("")}
</section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Carbon evidence pack, ${esc(d.orgName)}${d.bid.title ? `, ${esc(d.bid.title)}` : ""}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1b2328; line-height: 1.5 }
  .cover { background: #16323d; color: #fff; padding: 44px 40px 36px }
  .cover .kicker { font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; margin-top: 14px }
  .cover h1 { font-size: 22pt; font-weight: 700; margin: 4px 0 6px; letter-spacing: -0.01em }
  .cover .bid { font-size: 12pt; color: #bfd9dd }
  .cover .meta { font-size: 9pt; opacity: 0.7; margin-top: 18px }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 24px 40px 0 }
  .kpi { border: 1px solid #d5e1e3; border-radius: 6px; padding: 12px }
  .kpi .val { font-size: 15pt; font-weight: 700; color: #16323d; display: block; font-variant-numeric: tabular-nums }
  .kpi .lbl { font-size: 8.5pt; color: #4b5d63 }
  section { margin: 26px 40px }
  h2 { font-size: 13pt; font-weight: 700; color: #16323d; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 2px solid #16323d }
  h3 { font-size: 10.5pt; font-weight: 700; color: #16323d; margin: 16px 0 6px }
  p { margin-bottom: 6px; max-width: 170mm }
  .lead { font-size: 10.5pt }
  .muted { color: #5b6b70; font-size: 9pt }
  .note { color: #4b5d63; font-size: 8.5pt }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 6px 0 10px }
  th { background: #e9f1f2; color: #16323d; text-align: left; padding: 5px 8px; border: 1px solid #cddcdf }
  td { padding: 5px 8px; border: 1px solid #dde6e8; vertical-align: top }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap }
  table.sign td:first-child { width: 40%; color: #4b5d63 }
  table.sign td:last-child { height: 28px }
  .contract { margin-bottom: 14px; page-break-inside: avoid }
  .contract td.indent { padding-left: 18px; color: #5b6b70 }
  .answer { margin-top: 8px; padding: 8px 10px; background: #f6f8f7; border-left: 3px solid #c2410c }
  .answer p { margin: 2px 0 }
  .qa { margin-bottom: 12px; page-break-inside: avoid }
  .qa .q { font-weight: 700; color: #16323d }
  footer { font-size: 8pt; color: #6b7a7f; text-align: center; padding: 18px; border-top: 1px solid #dde6e8; margin-top: 30px }
  ${brandStyles()}
</style>
</head>
<body>

<div class="cover">
  ${brandLogoHtml(d.logoDataUri)}
  <p class="kicker">Carbon evidence pack</p>
  <h1>${esc(d.orgName)}</h1>
  ${d.bid.title || d.bid.buyer ? `<p class="bid">${[d.bid.title, d.bid.buyer].filter(Boolean).map((s) => esc(s as string)).join(" · ")}</p>` : ""}
  ${d.bid.reference ? `<p class="bid">Tender reference ${esc(d.bid.reference)}</p>` : ""}
  <p class="meta">${esc(d.snapshot.periodLabel)} · Snapshot v${d.snapshot.version} · Published ${fmtDate(d.snapshot.publishedAt)}</p>
</div>

<div class="kpis">
  <div class="kpi"><span class="val">${fmtT(d.current.total)}</span><span class="lbl">tCO₂e total, ${esc(d.snapshot.periodLabel)}</span></div>
  <div class="kpi"><span class="val">${fmtT(s12)}</span><span class="lbl">tCO₂e Scope 1 and 2</span></div>
  <div class="kpi"><span class="val">${vsBase != null ? fmtChange(vsBase) : "–"}</span><span class="lbl">Scope 1 and 2 vs ${d.baseYear ? esc(d.baseYear.label) : "base year"}</span></div>
  <div class="kpi"><span class="val">${d.netZeroYear ?? "Not set"}</span><span class="lbl">Net zero commitment</span></div>
</div>

${crp}
${trend}
${categories}
${contracts}
${social}
${assurance}
${qa}

<footer>${esc(d.orgName)} · Carbon evidence pack · Figures from published snapshot v${d.snapshot.version} (${esc(d.snapshot.periodLabel)})</footer>
</body>
</html>`;
}
