import { esc, brandLogoHtml, brandStyles } from "./shared";

export interface EcologySurveyAssessment {
  id: string;
  name: string;
  reference?: string | null;
  projectName?: string | null;
  siteName?: string | null;
  assessmentDate?: Date | null;
  ecologistName?: string | null;
  ecologistOrganisation?: string | null;
  planningAuthority?: string | null;
  planningReference?: string | null;
  metricVersion: string;
  status: string;
  meetsRequirement: boolean;
  baselineAreaUnits: number;
  baselineHedgerowUnits: number;
  baselineWatercourseUnits: number;
  postAreaUnits: number;
  postHedgerowUnits: number;
  postWatercourseUnits: number;
  parcelCount: number;
  speciesRecordCount: number;
}

export interface EcologySurveyData {
  orgName: string;
  logoDataUri?: string;
  publishedAt: Date;
  publishedBy: string;
  reportingPeriodLabel: string;
  assessments: EcologySurveyAssessment[];
  totalSpeciesRecords: number;
  totalAssessments: number;
  meetingRequirementCount: number;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "Not set";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtUnits(v: number): string {
  return v.toFixed(3);
}

function pctGain(baseline: number, post: number): string {
  if (baseline === 0) return post > 0 ? "+new" : "N/A";
  const pct = ((post - baseline) / baseline) * 100;
  return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
}

export function renderEcologySurveyHtml(data: EcologySurveyData): string {
  const { orgName, logoDataUri, publishedAt, publishedBy, reportingPeriodLabel, assessments } = data;
  const anyAssessments = assessments.length > 0;

  const assessmentRows = assessments.map((a) => {
    const areaGain = pctGain(a.baselineAreaUnits, a.postAreaUnits);
    const hedgeGain = pctGain(a.baselineHedgerowUnits, a.postHedgerowUnits);
    const watercourseGain = pctGain(a.baselineWatercourseUnits, a.postWatercourseUnits);
    const statusColor = a.meetsRequirement ? "#16a34a" : "#dc2626";
    return `
    <div class="assessment-card">
      <div class="assessment-header">
        <div>
          <div class="assessment-title">${esc(a.name)}${a.reference ? ` <span class="ref-chip">${esc(a.reference)}</span>` : ""}</div>
          <div class="assessment-meta">
            ${a.projectName ? `<span>Project: ${esc(a.projectName)}</span>` : ""}
            ${a.siteName ? `<span>Site: ${esc(a.siteName)}</span>` : ""}
            ${a.planningAuthority ? `<span>LPA: ${esc(a.planningAuthority)}</span>` : ""}
            ${a.planningReference ? `<span>App: ${esc(a.planningReference)}</span>` : ""}
          </div>
        </div>
        <div class="assessment-status" style="color:${statusColor};border-color:${statusColor}">
          ${a.meetsRequirement ? "Meets 10% BNG" : "Below 10% BNG"}
        </div>
      </div>
      <table class="units-table">
        <thead>
          <tr>
            <th>Module</th>
            <th>Baseline units</th>
            <th>Post-intervention units</th>
            <th>Net gain</th>
          </tr>
        </thead>
        <tbody>
          ${a.baselineAreaUnits > 0 || a.postAreaUnits > 0 ? `<tr>
            <td>Area habitats</td>
            <td>${fmtUnits(a.baselineAreaUnits)}</td>
            <td>${fmtUnits(a.postAreaUnits)}</td>
            <td class="${a.postAreaUnits >= a.baselineAreaUnits ? "gain" : "loss"}">${areaGain}</td>
          </tr>` : ""}
          ${a.baselineHedgerowUnits > 0 || a.postHedgerowUnits > 0 ? `<tr>
            <td>Hedgerows</td>
            <td>${fmtUnits(a.baselineHedgerowUnits)}</td>
            <td>${fmtUnits(a.postHedgerowUnits)}</td>
            <td class="${a.postHedgerowUnits >= a.baselineHedgerowUnits ? "gain" : "loss"}">${hedgeGain}</td>
          </tr>` : ""}
          ${a.baselineWatercourseUnits > 0 || a.postWatercourseUnits > 0 ? `<tr>
            <td>Watercourses</td>
            <td>${fmtUnits(a.baselineWatercourseUnits)}</td>
            <td>${fmtUnits(a.postWatercourseUnits)}</td>
            <td class="${a.postWatercourseUnits >= a.baselineWatercourseUnits ? "gain" : "loss"}">${watercourseGain}</td>
          </tr>` : ""}
        </tbody>
      </table>
      <div class="assessment-footer-meta">
        ${a.assessmentDate ? `<span>Survey: ${fmtDate(a.assessmentDate)}</span>` : ""}
        ${a.ecologistName ? `<span>Ecologist: ${esc(a.ecologistName)}${a.ecologistOrganisation ? ` (${esc(a.ecologistOrganisation)})` : ""}</span>` : ""}
        <span>Metric: ${esc(a.metricVersion)}</span>
        <span>${a.parcelCount} parcels</span>
        <span>${a.speciesRecordCount} species records</span>
      </div>
    </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Ecology &amp; BNG Survey Report</title>
<style>
${brandStyles()}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 9.5pt; color: #1a1a1a; background: #fff; }
.cover { padding: 32pt 0 24pt; border-bottom: 2pt solid #15803d; margin-bottom: 20pt; }
.report-label { font-size: 8pt; color: #16a34a; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 6pt; }
h1.report-title { font-size: 22pt; font-weight: 700; color: #14532d; letter-spacing: -0.02em; margin-bottom: 4pt; }
.period-label { font-size: 10pt; color: #4b5563; margin-bottom: 12pt; }
.meta-row { font-size: 8pt; color: #6b7280; }
.kpi-row { display: flex; gap: 16pt; margin: 16pt 0; }
.kpi-card { flex: 1; background: #f0fdf4; border: 0.75pt solid #bbf7d0; border-radius: 6pt; padding: 10pt 14pt; }
.kpi-value { font-size: 18pt; font-weight: 700; color: #15803d; letter-spacing: -0.02em; }
.kpi-label { font-size: 7.5pt; color: #4b5563; margin-top: 2pt; }
.section-title { font-size: 11pt; font-weight: 700; color: #14532d; margin: 20pt 0 10pt; border-bottom: 0.75pt solid #d1fae5; padding-bottom: 4pt; }
.assessment-card { border: 0.75pt solid #d1fae5; border-radius: 6pt; padding: 12pt; margin-bottom: 10pt; page-break-inside: avoid; }
.assessment-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8pt; }
.assessment-title { font-size: 10pt; font-weight: 700; color: #14532d; }
.ref-chip { font-size: 8pt; font-weight: 400; background: #dcfce7; padding: 1pt 5pt; border-radius: 10pt; margin-left: 5pt; }
.assessment-meta { font-size: 8pt; color: #6b7280; margin-top: 3pt; display: flex; flex-wrap: wrap; gap: 8pt; }
.assessment-status { font-size: 8pt; font-weight: 600; border: 0.75pt solid; padding: 3pt 8pt; border-radius: 10pt; white-space: nowrap; }
.units-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 6pt 0; }
.units-table th { background: #f0fdf4; font-weight: 600; text-align: left; padding: 4pt 6pt; border: 0.5pt solid #d1fae5; }
.units-table td { padding: 3pt 6pt; border: 0.5pt solid #e5e7eb; }
.units-table .gain { color: #16a34a; font-weight: 600; }
.units-table .loss { color: #dc2626; font-weight: 600; }
.assessment-footer-meta { font-size: 7.5pt; color: #6b7280; display: flex; flex-wrap: wrap; gap: 10pt; margin-top: 6pt; padding-top: 6pt; border-top: 0.5pt solid #e5e7eb; }
.no-data { color: #6b7280; font-style: italic; padding: 12pt; text-align: center; }
.footer { margin-top: 24pt; padding-top: 8pt; border-top: 0.75pt solid #d1d5db; font-size: 7.5pt; color: #9ca3af; display: flex; justify-content: space-between; }
</style>
</head>
<body>
<div class="cover">
  ${brandLogoHtml(logoDataUri, orgName)}
  <div class="report-label">Ecology &amp; Biodiversity Net Gain</div>
  <h1 class="report-title">Ecology Survey Report</h1>
  <div class="period-label">${esc(reportingPeriodLabel)}</div>
  <div class="meta-row">Published ${fmtDate(publishedAt)} by ${esc(publishedBy)}</div>
</div>

<div class="kpi-row">
  <div class="kpi-card">
    <div class="kpi-value">${data.totalAssessments}</div>
    <div class="kpi-label">BNG assessments</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-value">${data.meetingRequirementCount}</div>
    <div class="kpi-label">Meeting 10% requirement</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-value">${data.totalSpeciesRecords}</div>
    <div class="kpi-label">Protected species records</div>
  </div>
</div>

<div class="section-title">Biodiversity Net Gain Assessments</div>
${anyAssessments ? assessmentRows : '<p class="no-data">No biodiversity assessments recorded for this reporting period.</p>'}

<div class="footer">
  <span>${esc(orgName)} - Ecology Survey Report - ${esc(reportingPeriodLabel)}</span>
  <span>Statutory Biodiversity Metric | Environment Act 2021</span>
</div>
</body>
</html>`;
}
