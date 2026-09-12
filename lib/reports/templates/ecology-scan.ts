// Ecology Scan Report — NBN Atlas species inventory + MAGIC designated sites + FC woodland.
// Generated from EcologicalScan records; species conservation status is colour-coded per
// IUCN / UK Wildlife and Countryside Act categories.

import { esc, brandStyles, brandLogoHtml } from "./shared";
import type { ConservationRisk } from "@/lib/data-sources/nbn-atlas";
import { conservationRisk } from "@/lib/data-sources/nbn-atlas";

// ── Types ────────────────────────────────────────────────────────────────────

export interface EcologyScanSpecies {
  name: string;
  commonName: string | null;
  kingdom: string;
  group: string;
  occurrenceCount: number;
  lastSeen: string | null;
  conservationStatus?: string;
}

export interface EcologyScanSite {
  name: string;
  type: string;
  distanceKm: number | null;
  areaSqKm: number | null;
  notifiedOn: string | null;
  condition: string | null;
}

export interface EcologyScanWoodland {
  name: string;
  type: string;
  areaHa: number;
  ifc: string | null;
}

export interface EcologyScanRecord {
  id: string;
  postcode: string;
  radiusKm: number;
  scannedAt: Date | null;
  projectName: string | null;

  totalSpeciesCount: number;
  plantSpeciesCount: number;
  birdSpeciesCount: number;
  mammalSpeciesCount: number;
  invertSpeciesCount: number;
  reptileSpeciesCount: number;
  amphibianSpeciesCount: number;
  otherSpeciesCount: number;

  sssiCount: number;
  sacCount: number;
  spaCount: number;
  nvrCount: number;
  ancientWoodlandCount: number;

  woodlandTotalHa: number;
  broadleafHa: number;
  coniferHa: number;
  mixedWoodlandHa: number;

  designatedSites: EcologyScanSite[];
  woodlandData: EcologyScanWoodland[];
  speciesRecords: EcologyScanSpecies[];
}

export interface EcologyScanReportData {
  orgName: string;
  logoDataUri?: string;
  publishedAt: Date;
  publishedBy: string;
  scans: EcologyScanRecord[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d: Date | null | undefined): string =>
  d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";

const fmtNum = (n: number, dp = 1): string =>
  n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });

const RISK_LABEL: Record<ConservationRisk, string> = {
  critical:        "Critically Endangered",
  endangered:      "Endangered",
  vulnerable:      "Vulnerable",
  near_threatened: "Near Threatened",
  protected:       "Protected",
  least_concern:   "Least Concern",
  unknown:         "",
};

const RISK_COLOR: Record<ConservationRisk, string> = {
  critical:        "#dc2626",
  endangered:      "#ea580c",
  vulnerable:      "#d97706",
  near_threatened: "#ca8a04",
  protected:       "#1d4ed8",
  least_concern:   "#16a34a",
  unknown:         "#9ca3af",
};

function riskBadge(status: string | undefined): string {
  const risk = conservationRisk(status);
  if (risk === "unknown" || risk === "least_concern") return "";
  const color = RISK_COLOR[risk];
  const label = RISK_LABEL[risk];
  return `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:7.5pt;font-weight:600;color:#fff;background:${color};white-space:nowrap;">${esc(label)}</span>`;
}

const SITE_TYPE_ORDER = ["SSSI", "SAC", "SPA", "NNR", "AncientWoodland"];
function siteTypeOrder(t: string): number {
  const i = SITE_TYPE_ORDER.indexOf(t);
  return i === -1 ? SITE_TYPE_ORDER.length : i;
}

const SITE_TYPE_LABEL: Record<string, string> = {
  SSSI: "SSSI",
  SAC: "SAC",
  SPA: "SPA",
  NNR: "NNR",
  AncientWoodland: "Ancient Woodland",
};

function siteTypeBadge(type: string): string {
  const colors: Record<string, string> = {
    SSSI: "#0f766e",
    SAC: "#0369a1",
    SPA: "#7c3aed",
    NNR: "#15803d",
    AncientWoodland: "#92400e",
  };
  const bg = colors[type] ?? "#374151";
  const label = SITE_TYPE_LABEL[type] ?? type;
  return `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:7.5pt;font-weight:600;color:#fff;background:${bg};">${esc(label)}</span>`;
}

// ── Species breakdown bar chart (HTML, no SVG lib needed) ─────────────────────

function speciesBar(label: string, count: number, total: number, color: string): string {
  const pct = total > 0 ? (count / total) * 100 : 0;
  if (count === 0) return "";
  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
    <div style="width:110px;font-size:8.5pt;color:#374151;flex-shrink:0;">${esc(label)}</div>
    <div style="flex:1;background:#e5e7eb;border-radius:3px;height:12px;overflow:hidden;">
      <div style="width:${pct.toFixed(1)}%;height:100%;background:${color};border-radius:3px;"></div>
    </div>
    <div style="width:36px;text-align:right;font-size:8.5pt;font-weight:600;color:#111827;font-variant-numeric:tabular-nums;">${count}</div>
  </div>`;
}

// ── Single-scan section ───────────────────────────────────────────────────────

function renderScanSection(scan: EcologyScanRecord, idx: number): string {
  const designatedSorted = [...scan.designatedSites].sort(
    (a, b) => siteTypeOrder(a.type) - siteTypeOrder(b.type),
  );

  const siteRows = designatedSorted.map((s) => `
    <tr>
      <td>${siteTypeBadge(s.type)}</td>
      <td>${esc(s.name)}</td>
      <td class="num">${s.areaSqKm != null ? fmtNum(s.areaSqKm, 2) : "N/A"}</td>
      <td>${s.notifiedOn ? esc(s.notifiedOn) : "N/A"}</td>
      <td>${s.condition ? esc(s.condition) : "Not assessed"}</td>
    </tr>`).join("");

  const woodRows = [...scan.woodlandData]
    .sort((a, b) => b.areaHa - a.areaHa)
    .map((w) => `
    <tr>
      <td>${esc(w.name)}</td>
      <td>${esc(w.type)}</td>
      <td class="num">${fmtNum(w.areaHa, 2)}</td>
      <td>${w.ifc ? esc(w.ifc) : "N/A"}</td>
    </tr>`).join("");

  // Sort species: high-risk first, then alphabetical.
  const riskOrder: Record<ConservationRisk, number> = {
    critical: 0, endangered: 1, vulnerable: 2, near_threatened: 3,
    protected: 4, unknown: 5, least_concern: 6,
  };
  const speciesSorted = [...scan.speciesRecords].sort((a, b) => {
    const ra = riskOrder[conservationRisk(a.conservationStatus)];
    const rb = riskOrder[conservationRisk(b.conservationStatus)];
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  const speciesRows = speciesSorted.map((s) => `
    <tr>
      <td><em>${esc(s.name)}</em></td>
      <td>${s.commonName ? esc(s.commonName) : ""}</td>
      <td>${esc(s.group)}</td>
      <td class="num">${s.occurrenceCount}</td>
      <td>${s.lastSeen ?? "N/A"}</td>
      <td>${riskBadge(s.conservationStatus)}</td>
    </tr>`).join("");

  const highlightedCount = speciesSorted.filter(
    (s) => {
      const r = conservationRisk(s.conservationStatus);
      return r !== "unknown" && r !== "least_concern";
    },
  ).length;

  return `
  ${idx > 0 ? '<div class="page-break"></div>' : ""}
  <section>
    <div class="scan-header">
      <div>
        <div class="scan-title">Postcode: ${esc(scan.postcode)}&nbsp;
          <span class="scan-radius">within ${fmtNum(scan.radiusKm, 1)} km</span>
        </div>
        ${scan.projectName ? `<div class="scan-project">Project: ${esc(scan.projectName)}</div>` : ""}
      </div>
      <div class="scan-date">Scanned: ${fmtDate(scan.scannedAt)}</div>
    </div>

    <!-- KPI row -->
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-value">${scan.totalSpeciesCount.toLocaleString("en-GB")}</div>
        <div class="kpi-label">Unique species</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value" style="color:${highlightedCount > 0 ? "#dc2626" : "#16a34a"}">${highlightedCount}</div>
        <div class="kpi-label">At risk / protected</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${scan.sssiCount + scan.sacCount + scan.spaCount + scan.nvrCount + scan.ancientWoodlandCount}</div>
        <div class="kpi-label">Designated sites</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${fmtNum(scan.woodlandTotalHa, 1)}</div>
        <div class="kpi-label">Woodland ha</div>
      </div>
    </div>

    <!-- Species breakdown -->
    <h2>Species breakdown</h2>
    <div class="chart-wrap" style="padding:12px 0 8px;">
      ${speciesBar("Plants", scan.plantSpeciesCount, scan.totalSpeciesCount, "#16a34a")}
      ${speciesBar("Birds", scan.birdSpeciesCount, scan.totalSpeciesCount, "#0ea5e9")}
      ${speciesBar("Invertebrates", scan.invertSpeciesCount, scan.totalSpeciesCount, "#f59e0b")}
      ${speciesBar("Mammals", scan.mammalSpeciesCount, scan.totalSpeciesCount, "#8b5cf6")}
      ${speciesBar("Reptiles", scan.reptileSpeciesCount, scan.totalSpeciesCount, "#f97316")}
      ${speciesBar("Amphibians", scan.amphibianSpeciesCount, scan.totalSpeciesCount, "#06b6d4")}
      ${speciesBar("Other", scan.otherSpeciesCount, scan.totalSpeciesCount, "#9ca3af")}
    </div>

    ${scan.designatedSites.length > 0 ? `
    <h2>Designated sites <span class="section-count">(${scan.designatedSites.length})</span></h2>
    <p class="disc-ref">Sources: Natural England MAGIC / DEFRA ArcGIS — SSSI, SAC, SPA, NNR, Ancient Woodland Inventory</p>
    <table>
      <thead><tr>
        <th style="width:110px">Type</th>
        <th>Site name</th>
        <th class="num">Area (km²)</th>
        <th>Notified / confirmed</th>
        <th>Condition</th>
      </tr></thead>
      <tbody>${siteRows}</tbody>
    </table>` : `<p class="empty-note">No designated sites found within ${fmtNum(scan.radiusKm, 1)} km.</p>`}

    ${scan.woodlandData.length > 0 ? `
    <h2>Woodland inventory <span class="section-count">(${fmtNum(scan.woodlandTotalHa, 1)} ha total)</span></h2>
    <p class="disc-ref">Source: Forestry Commission National Forest Inventory (England)</p>
    <table>
      <thead><tr>
        <th>Woodland name</th>
        <th>Category</th>
        <th class="num">Area (ha)</th>
        <th>IFC status</th>
      </tr></thead>
      <tbody>${woodRows}</tbody>
      <tfoot><tr>
        <td colspan="2"><strong>Total woodland</strong></td>
        <td class="num"><strong>${fmtNum(scan.woodlandTotalHa, 2)}</strong></td>
        <td></td>
      </tr></tfoot>
    </table>` : ""}

    ${scan.speciesRecords.length > 0 ? `
    <div class="page-break"></div>
    <h2>Species inventory <span class="section-count">(${scan.speciesRecords.length} species recorded)</span></h2>
    <p class="disc-ref">Source: NBN Atlas (National Biodiversity Network). Conservation status: IUCN Red List / UK Wildlife and Countryside Act 1981. Species ordered by risk level.</p>
    <table>
      <thead><tr>
        <th>Scientific name</th>
        <th>Common name</th>
        <th>Group</th>
        <th class="num">Occurrences</th>
        <th>Last recorded</th>
        <th>Conservation status</th>
      </tr></thead>
      <tbody>${speciesRows}</tbody>
    </table>` : ""}
  </section>`;
}

// ── Main render function ──────────────────────────────────────────────────────

export function renderEcologyScanHtml(d: EcologyScanReportData): string {
  const totalSpecies = d.scans.reduce((s, sc) => s + sc.totalSpeciesCount, 0);
  const totalAtRisk = d.scans.reduce((s, sc) => s + sc.speciesRecords.filter(
    (sp) => {
      const r = conservationRisk(sp.conservationStatus);
      return r !== "unknown" && r !== "least_concern";
    },
  ).length, 0);
  const totalSites = d.scans.reduce(
    (s, sc) => s + sc.sssiCount + sc.sacCount + sc.spaCount + sc.nvrCount + sc.ancientWoodlandCount, 0,
  );
  const totalWoodland = d.scans.reduce((s, sc) => s + sc.woodlandTotalHa, 0);

  const scanSections = d.scans.map((sc, i) => renderScanSection(sc, i)).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Ecology Scan Report — ${esc(d.orgName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5 }
  ${brandStyles()}

  /* Cover */
  .cover { background: #14532d; color: #fff; padding: 40px }
  .cover h1 { font-size: 22pt; font-weight: 700; margin-bottom: 6px }
  .cover .sub { font-size: 11pt; margin-top: 4px; opacity: 0.85 }
  .cover .meta { font-size: 9pt; opacity: 0.7; margin-top: 16px; line-height: 1.7 }
  .cover .summary-kpis { display: flex; gap: 28px; margin-top: 28px }
  .cover .ckpi { border-left: 3px solid rgba(255,255,255,0.4); padding-left: 14px }
  .cover .ckpi-value { font-size: 22pt; font-weight: 700; line-height: 1 }
  .cover .ckpi-label { font-size: 8.5pt; opacity: 0.75; margin-top: 3px }

  /* Section layout */
  section { margin: 28px 40px }
  h2 { font-size: 11pt; font-weight: 700; color: #14532d; border-left: 4px solid #16a34a;
       padding-left: 10px; margin-bottom: 10px; margin-top: 22px }
  .section-count { font-weight: 400; font-size: 9pt; color: #6b7280 }
  .disc-ref { font-size: 8pt; color: #6b7280; font-style: italic; margin-bottom: 8px }
  .empty-note { font-size: 9pt; color: #9ca3af; padding: 12px 0 }

  /* Scan header */
  .scan-header { display: flex; justify-content: space-between; align-items: flex-start;
                  border-bottom: 2px solid #14532d; padding-bottom: 10px; margin-bottom: 16px }
  .scan-title { font-size: 14pt; font-weight: 700; color: #14532d }
  .scan-radius { font-size: 10pt; font-weight: 400; color: #6b7280 }
  .scan-project { font-size: 9pt; color: #6b7280; margin-top: 3px }
  .scan-date { font-size: 9pt; color: #6b7280; white-space: nowrap }

  /* KPI row */
  .kpi-row { display: flex; gap: 16px; margin-bottom: 18px }
  .kpi-card { flex: 1; border: 1px solid #d1fae5; border-radius: 6px; padding: 12px 14px;
               background: #f0fdf4 }
  .kpi-value { font-size: 18pt; font-weight: 700; color: #15803d; line-height: 1;
                font-variant-numeric: tabular-nums }
  .kpi-label { font-size: 8pt; color: #6b7280; margin-top: 4px }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8px }
  th { background: #dcfce7; color: #14532d; text-align: left; padding: 6px 8px;
       border: 1px solid #bbf7d0; font-size: 8.5pt }
  td { padding: 5px 8px; border: 1px solid #e5e7eb; vertical-align: middle }
  tr:nth-child(even) td { background: #f0fdf4 }
  tfoot td { background: #f9fafb; font-size: 9pt }
  .num { text-align: right; font-variant-numeric: tabular-nums }

  /* Risk legend */
  .risk-legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 8pt; margin: 10px 0 4px;
                  color: #374151 }
  .risk-legend-item { display: flex; align-items: center; gap: 5px }
  .risk-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0 }
</style>
</head>
<body>

<!-- Cover -->
<div class="cover">
  ${brandLogoHtml(d.logoDataUri, d.orgName)}
  <h1>Ecology Scan Report</h1>
  <div class="sub">${esc(d.orgName)}</div>
  <div class="meta">
    Published: ${fmtDate(d.publishedAt)}&nbsp;&nbsp;|&nbsp;&nbsp;By: ${esc(d.publishedBy)}<br>
    ${d.scans.length} scan location${d.scans.length !== 1 ? "s" : ""}
  </div>
  <div class="summary-kpis">
    <div class="ckpi">
      <div class="ckpi-value">${totalSpecies.toLocaleString("en-GB")}</div>
      <div class="ckpi-label">Total unique species</div>
    </div>
    <div class="ckpi">
      <div class="ckpi-value">${totalAtRisk}</div>
      <div class="ckpi-label">At risk / protected</div>
    </div>
    <div class="ckpi">
      <div class="ckpi-value">${totalSites}</div>
      <div class="ckpi-label">Designated sites</div>
    </div>
    <div class="ckpi">
      <div class="ckpi-value">${fmtNum(totalWoodland, 1)}</div>
      <div class="ckpi-label">Woodland ha</div>
    </div>
  </div>
</div>

<!-- Conservation risk key -->
<section>
  <h2>Conservation risk key</h2>
  <p class="disc-ref">Status derived from NBN Atlas countryConservation field. IUCN categories and UK Wildlife and Countryside Act (WCA) Schedule designations.</p>
  <div class="risk-legend">
    <div class="risk-legend-item"><div class="risk-dot" style="background:#dc2626"></div>Critically Endangered (CR)</div>
    <div class="risk-legend-item"><div class="risk-dot" style="background:#ea580c"></div>Endangered (EN)</div>
    <div class="risk-legend-item"><div class="risk-dot" style="background:#d97706"></div>Vulnerable (VU)</div>
    <div class="risk-legend-item"><div class="risk-dot" style="background:#ca8a04"></div>Near Threatened (NT)</div>
    <div class="risk-legend-item"><div class="risk-dot" style="background:#1d4ed8"></div>Protected (WCA / Schedule)</div>
    <div class="risk-legend-item"><div class="risk-dot" style="background:#16a34a"></div>Least Concern (LC)</div>
  </div>
</section>

${scanSections}

</body>
</html>`;
}
