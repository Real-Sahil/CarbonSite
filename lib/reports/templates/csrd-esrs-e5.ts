// CSRD ESRS E5 (Resource use and circular economy) report template.
// Covers: E5-5 waste generated, diverted from disposal, and hazardous
// waste, aligned with EFRAG ESRS E5 standard.
//
// Waste CO2e (Scope 3 Category 5) is reported separately in the GHG
// disclosures (csrd-esrs-e1, ghg-protocol) via each WasteRecord's linked
// ActivityRecord — this report covers only the physical-quantity/circular
// economy disclosures, not emissions.

import { esc, brandStyles, brandLogoHtml } from "./shared";

export interface CsrdEsrsE5Data {
  orgName: string;
  logoDataUri?: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  publishedAt: Date;
  publishedBy: string;
  totalGeneratedTonnes: number;
  totalDivertedTonnes: number;
  totalHazardousTonnes: number;
  recordCount: number;
  byDisposalRoute: Array<{ route: string; tonnes: number; hierarchy: "recycle" | "recovery" | "landfill" }>;
  facilities: Array<{ name: string; generatedTonnes: number; hazardousTonnes: number }>;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const fmtNum = (n: number, dp = 2) => n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });

const HIERARCHY_LABEL: Record<string, string> = {
  recycle: "Recycled / composted",
  recovery: "Energy recovery",
  landfill: "Landfill / disposal",
};

export function renderCsrdEsrsE5Html(d: CsrdEsrsE5Data): string {
  const diversionPct = d.totalGeneratedTonnes > 0 ? (d.totalDivertedTonnes / d.totalGeneratedTonnes) * 100 : 0;

  const routeRows = d.byDisposalRoute
    .sort((a, b) => b.tonnes - a.tonnes)
    .map((r) => `<tr>
      <td>${esc(r.route)}</td>
      <td>${esc(HIERARCHY_LABEL[r.hierarchy] ?? r.hierarchy)}</td>
      <td class="num">${fmtNum(r.tonnes)}</td>
    </tr>`)
    .join("");

  const facilityRows = d.facilities
    .sort((a, b) => b.generatedTonnes - a.generatedTonnes)
    .map((f) => `<tr>
      <td>${esc(f.name)}</td>
      <td class="num">${fmtNum(f.generatedTonnes)}</td>
      <td class="num">${fmtNum(f.hazardousTonnes)}</td>
    </tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>CSRD ESRS E5 Waste Disclosure — ${esc(d.orgName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5 }
  .cover { background: #78350f; color: #fff; padding: 40px }
  .cover h1 { font-size: 20pt; font-weight: 700; margin-bottom: 6px }
  .cover .sub { font-size: 11pt; margin-top: 4px; opacity: 0.85 }
  .cover .meta { font-size: 9pt; opacity: 0.7; margin-top: 16px }
  section { margin: 28px 40px }
  h2 { font-size: 12pt; font-weight: 700; color: #78350f; border-left: 4px solid #78350f; padding-left: 10px; margin-bottom: 12px }
  .disc-ref { font-size: 8.5pt; color: #666; font-style: italic; margin-bottom: 10px }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8px }
  th { background: #fef3c7; color: #78350f; text-align: left; padding: 6px 8px; border: 1px solid #fde68a }
  td { padding: 5px 8px; border: 1px solid #dde; vertical-align: top }
  tr:nth-child(even) td { background: #fffbeb }
  .num { text-align: right; font-variant-numeric: tabular-nums }
  .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px }
  .kpi { background: #fef3c7; border-radius: 6px; padding: 16px; }
  .kpi .val { font-size: 17pt; font-weight: 700; color: #78350f; display: block; margin: 4px 0 2px }
  .kpi .lbl { font-size: 8.5pt; color: #566; }
  .caution { background: #fff8e1; border-left: 3px solid #f9a825; padding: 10px 14px; font-size: 9pt; margin-top: 14px }
  footer { font-size: 8pt; color: #888; text-align: center; padding: 20px; border-top: 1px solid #ddd; margin-top: 32px }
  ${brandStyles()}
</style>
</head>
<body>

<div class="cover">
  ${brandLogoHtml(d.logoDataUri, d.orgName)}
  <h1>CSRD / ESRS E5 — Resource Use and Circular Economy</h1>
  <p class="sub">${esc(d.orgName)}</p>
  <p class="sub">Reporting period: ${esc(d.periodLabel)}</p>
  <p class="meta">Generated ${fmtDate(d.publishedAt)} by ${esc(d.publishedBy)}</p>
</div>

<section>
  <h2>E5-0 General Disclosures — Measurement Basis</h2>
  <p class="disc-ref">Reference: ESRS E5 paragraph 1, ESRS 1 Appendix B</p>
  <table>
    <tr><th>Disclosure field</th><th>Value</th></tr>
    <tr><td>Standard applied</td><td>ESRS E5 — Resource Use and Circular Economy (EFRAG)</td></tr>
    <tr><td>Reporting period</td><td>${fmtDate(d.periodStart)} - ${fmtDate(d.periodEnd)}</td></tr>
    <tr><td>Waste records included</td><td>${d.recordCount.toLocaleString("en-GB")}</td></tr>
  </table>
</section>

<section>
  <h2>E5-5 Resource Outflows — Waste</h2>
  <p class="disc-ref">Reference: ESRS E5 paragraphs 37-42</p>
  <div class="summary-grid">
    <div class="kpi"><span class="val">${fmtNum(d.totalGeneratedTonnes)} t</span><span class="lbl">Total waste generated</span></div>
    <div class="kpi"><span class="val">${fmtNum(diversionPct, 0)}%</span><span class="lbl">Diverted from disposal</span></div>
    <div class="kpi"><span class="val">${fmtNum(d.totalHazardousTonnes)} t</span><span class="lbl">Hazardous waste</span></div>
    <div class="kpi"><span class="val">${fmtNum(d.totalGeneratedTonnes - d.totalHazardousTonnes)} t</span><span class="lbl">Non-hazardous waste</span></div>
  </div>
  <table>
    <tr><th>Disposal route</th><th>Waste hierarchy tier</th><th class="num">Tonnes</th></tr>
    ${routeRows || '<tr><td colspan="3">No waste recorded for this period.</td></tr>'}
  </table>
</section>

<section>
  <h2>Facility Breakdown</h2>
  ${d.facilities.length > 0 ? `<table>
    <tr><th>Facility</th><th class="num">Generated (t)</th><th class="num">Hazardous (t)</th></tr>
    ${facilityRows}
  </table>` : "<p>No waste records for this period.</p>"}
</section>

<footer>
  ${esc(d.orgName)} · ESRS E5 Waste Disclosure · ${esc(d.periodLabel)}<br>
  Generated ${fmtDate(d.publishedAt)}
</footer>
</body>
</html>`;
}
