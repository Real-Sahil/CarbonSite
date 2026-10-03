// Site noticeboard: one contract's sustainability board for a site cabin or
// reception. Carbon, waste and social value come from the published snapshot;
// case studies are the organisation's own published stories, labelled as its
// own statement with the baseline and assumptions beside every figure.

import { esc, brandStyles, brandLogoHtml } from "./shared";
import { formatters } from "@/lib/i18n/org-format";
import { FIGURES_NOTE } from "@/lib/case-studies";
import type { NoticeboardData } from "@/lib/noticeboard/load";

const para = (s: string) => (s.trim() ? `<p>${esc(s).replace(/\r?\n/g, "<br>")}</p>` : "");

export function renderSiteNoticeboardHtml(d: NoticeboardData & { logoDataUri?: string }): string {
  const F = formatters(d.format);
  const p = d.pack;
  const c = d.contract;

  const tiles: { value: string; label: string }[] = [{ value: F.tonnes(c.tonnes), label: `tCO₂e measured on this contract, ${p.snapshot.periodLabel}` }];
  if (c.budgetTonnes != null && c.budgetTonnes > 0) {
    tiles.push({ value: F.percent(c.tonnes / c.budgetTonnes, 0), label: `of the ${F.tonnes(c.budgetTonnes)} tCO₂e carbon budget used` });
  }
  if (c.diversionRate != null) tiles.push({ value: F.percent(c.diversionRate), label: `of ${F.tonnes(c.wasteTonnes)} tonnes of waste diverted from landfill` });
  if (c.socialValuePounds > 0) tiles.push({ value: F.money(c.socialValuePounds, "GBP"), label: "National TOMs (UK) social value delivered, GBP" });

  const themes = c.socialValue.themes.filter((t) => t.pounds > 0);
  const social = themes.length
    ? `
<section>
  <h2>Social value delivered</h2>
  <table><tr><th>Theme</th><th class="num">Value (GBP)</th></tr>${themes
    .map((t) => `<tr><td>${esc(t.name)}</td><td class="num">${esc(F.money(t.pounds, "GBP"))}</td></tr>`)
    .join("")}</table>
  ${c.socialValue.measures.length ? `<p class="note">Largest measures: ${c.socialValue.measures.map((m) => `${esc(m.name)} (${F.number(m.quantity, 0)} ${esc(m.unit)})`).join("; ")}.</p>` : ""}
</section>`
    : "";

  const cards = d.caseStudies.length
    ? `
<section>
  <h2>What we are doing on this project</h2>
  ${d.caseStudies
    .map(
      (s) => `
  <div class="card">
    <h3>${esc(s.title)}</h3>
    ${s.photoDataUri ? `<img class="photo" src="${esc(s.photoDataUri)}" alt="">` : ""}
    ${s.problem ? `<p><strong>The problem.</strong> ${esc(s.problem)}</p>` : ""}
    ${s.solution ? `<p><strong>What we did.</strong> ${esc(s.solution)}</p>` : ""}
    ${
      s.kpis.length
        ? `<div class="kpis">${s.kpis.map((k) => `<div class="kpi"><span class="val">${esc(k.value)}</span><span class="lbl">${esc(k.label)}${k.note ? `<br><span class="note">${esc(k.note)}</span>` : ""}</span></div>`).join("")}</div>`
        : ""
    }
    ${s.results ? `<p><strong>Results.</strong> ${esc(s.results)}</p>` : ""}
    ${s.kpis.length ? `<p class="note"><strong>Measured against:</strong> ${s.baseline ? esc(s.baseline) : "not stated"}. <strong>Assumptions:</strong> ${s.assumptions ? esc(s.assumptions) : "not stated"}.</p>` : ""}
  </div>`,
    )
    .join("")}
  <p class="note">${esc(FIGURES_NOTE)}</p>
</section>`
    : "";

  const policies = d.policies.length
    ? `
<section>
  <h2>Our policy</h2>
  ${d.policies
    .map((pol) => `<div class="card"><h3>${esc(pol.title)}</h3>${para(pol.body)}<p class="note">Version ${pol.version}${pol.approvedOn ? `, approved ${esc(F.date(pol.approvedOn))}` : ""}.</p></div>`)
    .join("")}
</section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Site noticeboard, ${esc(c.name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt; color: #1b2328; line-height: 1.5 }
  .head { background: #16323d; color: #fff; padding: 36px 40px 30px }
  .head .kicker { font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; margin-top: 12px }
  .head h1 { font-size: 24pt; font-weight: 700; margin: 4px 0 6px; letter-spacing: -0.01em }
  .head .meta { font-size: 10pt; opacity: 0.8 }
  .tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 24px 40px 0 }
  .tile { border: 1px solid #d5e1e3; border-radius: 6px; padding: 14px }
  .tile .val { font-size: 22pt; font-weight: 700; color: #16323d; display: block; font-variant-numeric: tabular-nums }
  .tile .lbl { font-size: 9.5pt; color: #4b5d63 }
  section { margin: 26px 40px }
  h2 { font-size: 14pt; font-weight: 700; color: #16323d; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 2px solid #16323d }
  h3 { font-size: 12pt; font-weight: 700; color: #16323d; margin-bottom: 6px }
  p { margin-bottom: 6px; max-width: 170mm }
  .note { color: #4b5d63; font-size: 8.5pt }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 6px 0 10px }
  th { background: #e9f1f2; color: #16323d; text-align: left; padding: 5px 8px; border: 1px solid #cddcdf }
  td { padding: 5px 8px; border: 1px solid #dde6e8 }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap }
  .card { border: 1px solid #d5e1e3; border-radius: 6px; padding: 14px 16px; margin-bottom: 12px; page-break-inside: avoid }
  .photo { display: block; max-width: 100%; max-height: 70mm; border-radius: 4px; margin: 4px 0 10px }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0 }
  .kpi { background: #16323d; color: #fff; border-radius: 6px; padding: 10px 12px }
  .kpi .val { font-size: 16pt; font-weight: 700; display: block }
  .kpi .lbl { font-size: 8.5pt; opacity: 0.85 }
  .kpi .note { color: #cfe0e3 }
  footer { font-size: 8pt; color: #6b7a7f; text-align: center; padding: 18px; border-top: 1px solid #dde6e8; margin-top: 30px }
  ${brandStyles()}
</style>
</head>
<body>

<div class="head">
  ${brandLogoHtml(d.logoDataUri)}
  <p class="kicker">Sustainability on site</p>
  <h1>${esc(c.name)}</h1>
  <p class="meta">${[c.client, c.reference].filter(Boolean).map((x) => esc(x as string)).join(" · ")}${c.client || c.reference ? " · " : ""}${esc(d.orgName)} · ${esc(p.snapshot.periodLabel)}</p>
</div>

<div class="tiles">
  ${tiles.map((t) => `<div class="tile"><span class="val">${esc(t.value)}</span><span class="lbl">${esc(t.label)}</span></div>`).join("")}
</div>

${social}
${cards}
${policies}
${para("")}
<footer>${esc(d.orgName)} · Carbon, waste and social value from published snapshot v${p.snapshot.version} (${esc(p.snapshot.periodLabel)}), calculated from the organisation's records · Case study figures are stated by the organisation</footer>
</body>
</html>`;
}
