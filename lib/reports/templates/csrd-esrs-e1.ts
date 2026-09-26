// CSRD ESRS E1 (Climate change) report template.
// Covers mandatory disclosures: E1-1 Transition plan, E1-5 Energy,
// E1-6 Gross Scopes 1/2/3, E1-7 GHG removals, E1-9 Anticipated financial effects.
// Aligns with EFRAG ESRS E1 standard (January 2023, effective FY2024+).

import { esc, brandStyles, brandLogoHtml } from "./shared";

export interface CsrdEsrsE1Data {
  orgName: string;
  logoDataUri?: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  snapshotVersion: number;
  publishedAt: Date;
  publishedBy: string;
  factorLibrary: string;
  methodology: string;
  gwpVersion: string;
  scope1Tonnes: number;
  scope2LocationTonnes: number;
  /** Null when no record was calculated market-based: there is no figure, not a zero. */
  scope2MarketTonnes: number | null;
  scope3Tonnes: number;
  totalTonnes: number;
  recordCount: number;
  co2Tonnes?: number;
  ch4Tonnes?: number;
  n2oTonnes?: number;
  biogenicCo2Tonnes?: number;
  netZeroTargetYear?: number;
  baselineYear?: string;
  baselineTonnes?: number;
  interimTargetYear?: number;
  interimReductionPct?: number;
  /** Energy from the run's records (secrEnergyFromCalculations()), kWh. */
  energy?: { fuelsKwh: number; electricityKwh: number; transportKwh: number; totalKwh: number; unconverted: number };
  /** The internal carbon price in force at the period end, if any. */
  carbonPrice?: { name: string; priceType: string; pricePerTonne: number; currency: string; basis: string | null } | null;
  categories: Array<{ name: string; scope: number; totalKg: number; count: number }>;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const fmtNum = (n: number, dp = 2) => n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const fmtYN = (v: boolean) => v ? "Yes" : "No";

export function renderCsrdEsrsE1Html(d: CsrdEsrsE1Data): string {
  const s3Rows = d.categories
    .filter((c) => c.scope === 3)
    .sort((a, b) => b.totalKg - a.totalKg)
    .map((c) => `<tr><td>${esc(c.name)}</td><td class="num">${c.count}</td><td class="num">${fmtNum(c.totalKg / 1000)} tCO₂e</td></tr>`)
    .join("");

  const allRows = d.categories
    .sort((a, b) => a.scope - b.scope || b.totalKg - a.totalKg)
    .map((c) => `<tr><td>${c.scope}</td><td>${esc(c.name)}</td><td class="num">${c.count}</td><td class="num">${fmtNum(c.totalKg / 1000)}</td></tr>`)
    .join("");

  const hasTarget = !!(d.netZeroTargetYear || d.interimTargetYear);
  const targetRows = hasTarget || d.baselineYear ? `
    ${d.baselineYear ? `<tr><td>Base year</td><td>${esc(d.baselineYear)} — ${d.baselineTonnes !== undefined ? fmtNum(d.baselineTonnes) + " tCO₂e" : "see disclosure"}</td></tr>` : ""}
    ${d.interimTargetYear ? `<tr><td>Interim target</td><td>${d.interimTargetYear}: ${d.interimReductionPct !== undefined ? `−${d.interimReductionPct}% vs baseline` : "see disclosure"}</td></tr>` : ""}
    ${d.netZeroTargetYear ? `<tr><td>Net-zero target</td><td>${d.netZeroTargetYear}</td></tr>` : ""}
  ` : "<tr><td colspan='2'>No quantified GHG target set for this period.</td></tr>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>CSRD ESRS E1 Climate Change Disclosure — ${esc(d.orgName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5 }
  .cover { background: #1c3557; color: #fff; padding: 40px }
  .cover h1 { font-size: 20pt; font-weight: 700; margin-bottom: 6px }
  .cover .sub { font-size: 11pt; margin-top: 4px; opacity: 0.85 }
  .cover .meta { font-size: 9pt; opacity: 0.7; margin-top: 16px }
  .pill { display: inline-block; background: rgba(255,255,255,0.15); padding: 3px 10px; border-radius: 20px; font-size: 9pt; margin-top: 10px }
  section { margin: 28px 40px }
  h2 { font-size: 12pt; font-weight: 700; color: #1c3557; border-left: 4px solid #1c3557; padding-left: 10px; margin-bottom: 12px }
  .disc-ref { font-size: 8.5pt; color: #666; font-style: italic; margin-bottom: 10px }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8px }
  th { background: #eef2f7; color: #1c3557; text-align: left; padding: 6px 8px; border: 1px solid #c5d0de }
  td { padding: 5px 8px; border: 1px solid #dde; vertical-align: top }
  tr:nth-child(even) td { background: #f7f9fc }
  .num { text-align: right; font-variant-numeric: tabular-nums }
  .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px }
  .kpi { background: #eef2f7; border-radius: 6px; padding: 16px; }
  .kpi .val { font-size: 17pt; font-weight: 700; color: #1c3557; display: block; margin: 4px 0 2px }
  .kpi .lbl { font-size: 8.5pt; color: #566; }
  .caution { background: #fff8e1; border-left: 3px solid #f9a825; padding: 10px 14px; font-size: 9pt; margin-top: 14px }
  footer { font-size: 8pt; color: #888; text-align: center; padding: 20px; border-top: 1px solid #ddd; margin-top: 32px }
  ${brandStyles()}
</style>
</head>
<body>

<div class="cover">
  ${brandLogoHtml(d.logoDataUri, d.orgName)}
  <h1>CSRD / ESRS E1 — Climate Change</h1>
  <p class="sub">${esc(d.orgName)}</p>
  <p class="sub">Financial period: ${esc(d.periodLabel)}</p>
  <p class="meta">Published ${fmtDate(d.publishedAt)} by ${esc(d.publishedBy)}</p>
  <span class="pill">Snapshot v${d.snapshotVersion}</span>
</div>

<section>
  <h2>E1-0 General Disclosures — Measurement Basis</h2>
  <p class="disc-ref">Reference: ESRS E1 paragraph 1, ESRS 1 Appendix B</p>
  <table>
    <tr><th>Disclosure field</th><th>Value</th></tr>
    <tr><td>Standard applied</td><td>ESRS E1 — Climate Change (EFRAG, January 2023)</td></tr>
    <tr><td>Reporting boundary</td><td>Operational control (GHG Protocol)</td></tr>
    <tr><td>Methodology</td><td>${esc(d.methodology)}</td></tr>
    <tr><td>GWP values</td><td>${esc(d.gwpVersion)} (aligned with IPCC AR6)</td></tr>
    <tr><td>Emission factor library</td><td>${esc(d.factorLibrary)}</td></tr>
    <tr><td>Reporting period</td><td>${fmtDate(d.periodStart)} – ${fmtDate(d.periodEnd)}</td></tr>
    <tr><td>Activity records included</td><td>${d.recordCount.toLocaleString("en-GB")}</td></tr>
    <tr><td>Snapshot version</td><td>v${d.snapshotVersion} (immutable, auditable)</td></tr>
  </table>
</section>

<section>
  <h2>E1-1 Transition Plan</h2>
  <p class="disc-ref">Reference: ESRS E1 paragraphs 14–24</p>
  <table>
    <tr><th>Disclosure</th><th>Value</th></tr>
    <tr><td>GHG reduction target set</td><td>${fmtYN(hasTarget)}</td></tr>
    ${targetRows}
    <tr><td>Alignment with Paris Agreement (1.5°C)</td><td>See transition plan documentation</td></tr>
    <tr><td>Carbon credits used to offset Scope 1/2</td><td>Not disclosed for this period</td></tr>
  </table>
</section>

<section>
  <h2>E1-5 Energy Consumption and Mix</h2>
  <p class="disc-ref">Reference: ESRS E1 paragraphs 37–41</p>
  ${d.energy && d.energy.totalKwh > 0 ? `<table>
    <thead><tr><th>Energy source</th><th class="num">MWh</th></tr></thead>
    <tbody>
      <tr><td>Fuels for heat, power and plant</td><td class="num">${fmtNum(d.energy.fuelsKwh / 1000, 0)}</td></tr>
      <tr><td>Transport fuels</td><td class="num">${fmtNum(d.energy.transportKwh / 1000, 0)}</td></tr>
      <tr><td>Purchased electricity</td><td class="num">${fmtNum(d.energy.electricityKwh / 1000, 0)}</td></tr>
      <tr><td><strong>Total energy consumption</strong></td><td class="num"><strong>${fmtNum(d.energy.totalKwh / 1000, 0)}</strong></td></tr>
    </tbody>
  </table>
  <p style="font-size:9pt;color:#6b7280;">From the activity records in this snapshot: kWh as recorded, fuel in litres at DESNZ gross calorific values.${d.energy.unconverted > 0 ? ` ${d.energy.unconverted} fuel or energy record${d.energy.unconverted === 1 ? " is" : "s are"} in units with no kWh equivalent and not included.` : ""} The split between fossil, nuclear and renewable sources is not calculated.</p>`
  : `<div class="caution">No energy records with a kWh equivalent in this snapshot.</div>`}
</section>

<section>
  <h2>E1-6 Gross Scopes 1, 2, 3 GHG Emissions</h2>
  <p class="disc-ref">Reference: ESRS E1 paragraphs 44–51, Appendix A.1</p>
  <div class="summary-grid">
    <div class="kpi"><span class="val">${fmtNum(d.scope1Tonnes)} tCO₂e</span><span class="lbl">Gross Scope 1 — Direct emissions</span></div>
    <div class="kpi"><span class="val">${fmtNum(d.scope2LocationTonnes)} tCO₂e</span><span class="lbl">Gross Scope 2 — Location-based</span></div>
    <div class="kpi"><span class="val">${d.scope2MarketTonnes == null ? "Not calculated" : `${fmtNum(d.scope2MarketTonnes)} tCO₂e`}</span><span class="lbl">Gross Scope 2 — Market-based</span></div>
    <div class="kpi"><span class="val">${fmtNum(d.scope3Tonnes)} tCO₂e</span><span class="lbl">Gross Scope 3 — Value chain</span></div>
  </div>
  <table>
    <tr><th>Scope</th><th>Category</th><th class="num">Records</th><th class="num">tCO₂e</th></tr>
    ${allRows}
    <tr style="font-weight:700"><td colspan="3">Total</td><td class="num">${fmtNum(d.totalTonnes)}</td></tr>
  </table>
</section>

<section>
  <h2>E1-6a GHG Emissions by Gas (AR6 GWP)</h2>
  <p class="disc-ref">Reference: ESRS E1 Appendix A.1 — gas-level split required under mandatory phase-in</p>
  <table>
    <tr><th>Greenhouse gas</th><th class="num">Gross (tCO₂e)</th><th>Notes</th></tr>
    ${d.co2Tonnes !== undefined ? `<tr><td>Carbon dioxide (CO₂)</td><td class="num">${fmtNum(d.co2Tonnes)}</td><td>Fossil combustion and process emissions</td></tr>` : ""}
    ${d.ch4Tonnes !== undefined ? `<tr><td>Methane (CH₄)</td><td class="num">${fmtNum(d.ch4Tonnes)}</td><td>GWP₁₀₀ = 27.9 (IPCC AR6)</td></tr>` : ""}
    ${d.n2oTonnes !== undefined ? `<tr><td>Nitrous oxide (N₂O)</td><td class="num">${fmtNum(d.n2oTonnes)}</td><td>GWP₁₀₀ = 273 (IPCC AR6)</td></tr>` : ""}
    ${d.biogenicCo2Tonnes !== undefined ? `<tr><td>Biogenic CO₂ (CO₂b)</td><td class="num">${fmtNum(d.biogenicCo2Tonnes)}</td><td>Reported separately — not included in Scope 1 total per GHG Protocol</td></tr>` : ""}
    <tr style="font-weight:700"><td>Total GHG (fossil + non-CO₂)</td><td class="num">${fmtNum(d.totalTonnes)}</td><td>Matches E1-6 total</td></tr>
  </table>
  ${(!d.co2Tonnes && !d.ch4Tonnes && !d.n2oTonnes) ? '<div class="caution">Gas-level split not available for this calculation run. Re-run calculations with a factor library that includes gas-specific CO₂, CH₄, and N₂O values.</div>' : ""}
</section>

<section>
  <h2>E1-7 GHG Removals and Carbon Credits</h2>
  <p class="disc-ref">Reference: ESRS E1 paragraphs 52–57</p>
  <p>No verified GHG removals or carbon credits were recognised in this reporting period.</p>
</section>

<section>
  <h2>E1-8 Internal Carbon Pricing</h2>
  <p class="disc-ref">Reference: ESRS E1 paragraphs 58–60</p>
  ${d.carbonPrice
    ? `<table><tbody>
      <tr><td>Scheme</td><td>${esc(d.carbonPrice.name)} (${esc(d.carbonPrice.priceType.replace("_", " "))})</td></tr>
      <tr><td>Price in force at period end</td><td>${esc(d.carbonPrice.currency)} ${fmtNum(d.carbonPrice.pricePerTonne)} per tCO₂e</td></tr>
      ${d.carbonPrice.basis ? `<tr><td>Basis</td><td>${esc(d.carbonPrice.basis)}</td></tr>` : ""}
    </tbody></table>`
    : "<p>No internal carbon price was in force at the end of this reporting period.</p>"}
</section>

<section>
  <h2>E1-9 Anticipated Financial Effects — Climate-Related Risks</h2>
  <p class="disc-ref">Reference: ESRS E1 paragraphs 61–70</p>
  <p>Qualitative and quantitative financial effect disclosures (transition risks and physical risks)
     are maintained separately in the organisation's TCFD-aligned risk register. Reference those
     disclosures for E1-9 compliance.</p>
</section>

<section>
  <h2>Scope 3 Category Detail</h2>
  ${s3Rows ? `<table><thead><tr><th>Category</th><th class="num">Records</th><th class="num">tCO₂e</th></tr></thead><tbody>${s3Rows}</tbody></table>` : "<p>No Scope 3 activity recorded in this period.</p>"}
</section>

<footer>
  ${esc(d.orgName)} · ESRS E1 Climate Disclosure · ${esc(d.periodLabel)} · Snapshot v${d.snapshotVersion}<br>
  Generated ${fmtDate(d.publishedAt)} · ${esc(d.factorLibrary)}
</footer>
</body>
</html>`;
}
