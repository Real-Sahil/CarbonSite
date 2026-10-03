// Climate-related financial disclosure statement, in the TCFD structure
// (governance, strategy, risk management, metrics and targets). It prints what
// the organisation wrote and recorded, plus the published totals of the
// report's snapshot. It claims consistency with the recommendations only when
// every disclosure is met and the board has approved this version; otherwise
// it says how many are addressed. Not tied to any one jurisdiction.

import { esc, brandStyles, brandLogoHtml } from "./shared";
import { formatters } from "@/lib/i18n/org-format";
import {
  FRAMEWORK_NOTE,
  IFRS_S2_AREAS,
  HORIZONS,
  PILLARS,
  RATING_LABELS,
  RISK_KINDS,
  RISK_STATUSES,
  coverage,
  inherentScore,
  mayClaimConsistency,
  ratingOf,
  residualScore,
  type RiskRow,
} from "@/lib/climate-disclosure";
import type { ClimateDisclosureView } from "@/lib/climate-disclosure/load";

const para = (s: string) => (s.trim() ? `<p>${esc(s).replace(/\r?\n/g, "<br>")}</p>` : `<p class="muted">Not yet written.</p>`);
const kindLabel = (k: string) => RISK_KINDS.find((x) => x.value === k)?.label ?? k;
const statusLabel = (s: string) => RISK_STATUSES.find((x) => x.value === s)?.label ?? s;
const horizonLabel = (h: string) => HORIZONS.find((x) => x.value === h)?.label ?? h;
const STATUS_TEXT = { met: "Addressed", partial: "Partly addressed", gap: "Not yet addressed" } as const;

const scoreCell = (s: number | null) =>
  s == null ? `<span class="muted">Not assessed</span>` : `${s} <span class="muted">(${RATING_LABELS[ratingOf(s)]})</span>`;

function riskTable(rows: RiskRow[]) {
  return `<table class="risks">
    <tr><th style="width:30%">Risk or opportunity</th><th style="width:9%">Horizon</th><th style="width:13%" class="num">Before</th><th style="width:13%" class="num">After</th><th>Response and owner</th><th style="width:10%">Status</th></tr>
    ${rows
      .map(
        (r) => `<tr>
      <td><strong>${esc(r.title)}</strong><br><span class="note">${esc(kindLabel(r.kind))}</span>${r.description ? `<br><span class="muted">${esc(r.description)}</span>` : ""}${r.financialEffect ? `<br><span class="note">Financial effect: ${esc(r.financialEffect)}</span>` : ""}</td>
      <td>${esc(horizonLabel(r.horizon))}</td>
      <td class="num">${scoreCell(inherentScore(r))}</td>
      <td class="num">${scoreCell(residualScore(r))}</td>
      <td>${r.mitigation ? esc(r.mitigation) : `<span class="muted">None recorded</span>`}${r.ownerRole ? `<br><span class="note">Owner: ${esc(r.ownerRole)}</span>` : ""}</td>
      <td>${esc(statusLabel(r.status))}</td>
    </tr>`,
      )
      .join("")}
  </table>`;
}

export function renderTcfdStatementHtml(d: ClimateDisclosureView & { orgName: string; logoDataUri?: string }): string {
  const s = d.sections;
  const F = formatters(d.format);
  const fmtDate = F.date;
  const fmtT = F.tonnes;
  const approved = d.status === "approved" && d.approvedAt != null;
  const cov = coverage(d.checklist);
  const consistent = mayClaimConsistency(d.checklist, approved);
  const period = d.snapshot;

  const statement = consistent
    ? `<p>This statement is consistent with the eleven recommended disclosures of the TCFD. It was approved by ${esc(d.approvalBody ?? "the board")} on ${fmtDate(d.approvedAt!)}.</p>`
    : `<p>This statement addresses ${cov.met} of the ${cov.total} recommended disclosures${approved ? "" : " and has not yet been approved by the board"}. The table shows each one.</p>`;

  const coverageTable = PILLARS.map(
    (p) => `
    <tr class="pillar"><td colspan="4">${esc(p.label)}</td></tr>
    ${d.checklist
      .filter((c) => c.pillar === p.value)
      .map((c) => `<tr><td>${esc(c.code)}</td><td>${esc(c.label)}</td><td class="note">${esc(IFRS_S2_AREAS[c.id] ?? "")}</td><td>${STATUS_TEXT[c.status]}</td></tr>`)
      .join("")}`,
  ).join("");

  const physicalAndTransition = d.risks.filter((r) => r.status !== "closed");
  const horizonRows = HORIZONS.map((h) => `<tr><td>${h.label}</td><td>${s.horizons[h.value] ? esc(s.horizons[h.value]) : `<span class="muted">Not defined</span>`}</td></tr>`).join("");

  const scenarios = s.scenarios.length
    ? `<table>
    <tr><th>Scenario</th><th>Source</th><th>Transition</th><th>Physical</th></tr>
    ${s.scenarios
      .map(
        (x) =>
          `<tr><td><strong>${esc(x.name)}</strong>${x.lowCarbon ? `<br><span class="note">Consistent with 2°C or lower</span>` : ""}</td><td>${esc(x.source)}</td><td>${esc(x.transition)}</td><td>${esc(x.physical)}</td></tr>`,
      )
      .join("")}
  </table>`
    : `<p class="muted">No scenarios recorded.</p>`;

  const totals = d.totals;
  const emissions = totals
    ? `<table>
    <tr><th>Emissions (tCO₂e), ${esc(period?.label ?? "")}</th><th class="num">Scope 1</th><th class="num">Scope 2</th><th class="num">Scope 3</th><th class="num">Total</th></tr>
    <tr><td>Published snapshot v${period?.version}</td><td class="num">${fmtT(totals.s1)}</td><td class="num">${fmtT(totals.s2)}</td><td class="num">${fmtT(totals.s3)}</td><td class="num"><strong>${fmtT(totals.total)}</strong></td></tr>
  </table>
  <p class="note">Scope 2 is location-based${totals.s2Market != null ? `. Market-based Scope 2, shown beside the total and not added to it: ${fmtT(totals.s2Market)} tCO₂e` : ""}. Published figures cannot be edited; a correction creates a new version.</p>`
    : `<p class="muted">No published emissions totals.</p>`;

  const targets =
    d.targets.length || d.netZeroYear != null
      ? `${d.netZeroYear != null ? `<p>Net zero commitment: <strong>${d.netZeroYear}</strong>.</p>` : ""}
  ${
    d.targets.length
      ? `<table><tr><th>Type</th><th>From</th><th>To</th><th class="num">Reduction (tCO₂e)</th></tr>${d.targets
          .map((t) => `<tr><td>${t.type === "absolute" ? "Absolute" : "Intensity"}</td><td>${esc(t.from)}</td><td>${esc(t.to)}</td><td class="num">${fmtT(t.reductionTonnes)}</td></tr>`)
          .join("")}</table>`
      : ""
  }`
      : `<p class="muted">No targets recorded.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Climate-related financial disclosure, ${esc(d.orgName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1b2328; line-height: 1.5 }
  .cover { background: #16323d; color: #fff; padding: 44px 40px 36px }
  .cover .kicker { font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; margin-top: 14px }
  .cover h1 { font-size: 22pt; font-weight: 700; margin: 4px 0 6px; letter-spacing: -0.01em }
  .cover .meta { font-size: 9pt; opacity: 0.7; margin-top: 18px }
  section { margin: 26px 40px }
  h2 { font-size: 13pt; font-weight: 700; color: #16323d; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 2px solid #16323d }
  h3 { font-size: 10.5pt; font-weight: 700; color: #16323d; margin: 16px 0 6px }
  p { margin-bottom: 6px; max-width: 170mm }
  .muted { color: #5b6b70; font-size: 9pt }
  .note { color: #4b5d63; font-size: 8.5pt }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 6px 0 10px }
  th { background: #e9f1f2; color: #16323d; text-align: left; padding: 5px 8px; border: 1px solid #cddcdf }
  td { padding: 5px 8px; border: 1px solid #dde6e8; vertical-align: top }
  table.risks { table-layout: fixed }
  table.risks td.num { white-space: normal }
  h3 { page-break-after: avoid }
  tr.pillar td { background: #f1f6f6; font-weight: 700; color: #16323d }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap }
  footer { font-size: 8pt; color: #6b7a7f; text-align: center; padding: 18px; border-top: 1px solid #dde6e8; margin-top: 30px }
  ${brandStyles()}
</style>
</head>
<body>

<div class="cover">
  ${brandLogoHtml(d.logoDataUri)}
  <p class="kicker">Climate-related financial disclosure</p>
  <h1>${esc(d.orgName)}</h1>
  <p class="meta">${period ? `${esc(period.label)} (${fmtDate(period.startDate)} to ${fmtDate(period.endDate)})` : ""}${approved ? ` · Approved ${fmtDate(d.approvedAt!)}` : " · Draft"}</p>
</div>

<section>
  <h2>About this statement</h2>
  ${statement}
  <table>
    <tr><th>Reference</th><th>Recommended disclosure</th><th>IFRS S2 area (indicative)</th><th>Status</th></tr>
    ${coverageTable}
  </table>
  <p class="note">${esc(FRAMEWORK_NOTE)}</p>
</section>

<section>
  <h2>Governance</h2>
  <h3>Board oversight</h3>
  ${para(s.governanceBoard)}
  <h3>Management's role</h3>
  ${para(s.governanceManagement)}
</section>

<section>
  <h2>Strategy</h2>
  <h3>Time horizons</h3>
  <table><tr><th>Horizon</th><th>Meaning for this organisation</th></tr>${horizonRows}</table>
  <h3>Climate-related risks and opportunities</h3>
  ${physicalAndTransition.length ? riskTable(physicalAndTransition) : `<p class="muted">None recorded.</p>`}
  <h3>Impact on the business, strategy and financial planning</h3>
  ${para(s.strategyImpact)}
  <h3>Resilience under different scenarios</h3>
  ${scenarios}
  ${para(s.scenarioNarrative)}
</section>

<section>
  <h2>Risk management</h2>
  <h3>Identifying and assessing risks</h3>
  ${para(s.riskIdentification)}
  <h3>Managing risks</h3>
  ${para(s.riskManagement)}
  <h3>Integration into overall risk management</h3>
  ${para(s.riskIntegration)}
  <p class="note">Before and After are the score before and after the organisation's response. Risks are scored 1 to 5 for likelihood and for impact; the score is the product (1 to 25): up to 4 low, up to 9 medium, up to 15 high, above that very high.</p>
</section>

<section>
  <h2>Metrics and targets</h2>
  ${para(s.metricsNarrative)}
  <h3>Greenhouse gas emissions</h3>
  ${emissions}
  <h3>Targets</h3>
  ${targets}
</section>

<footer>${esc(d.orgName)} · Climate-related financial disclosure${period ? ` · Emissions from published snapshot v${period.version} (${esc(period.label)})` : ""}</footer>
</body>
</html>`;
}
