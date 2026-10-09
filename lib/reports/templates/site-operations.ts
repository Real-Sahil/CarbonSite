// Site operations: one period's fuel stores, plant, hazardous and controlled material loads, waste licences and
// permits, carrier register checks and Site Waste Management Plan progress. A section with nothing to show is left
// out, and the page says what the records do not cover. It describes whether evidence is complete; it never says a
// load or a licence is lawful.

import { esc, brandStyles, brandLogoHtml } from "./shared";
import { formatters, type OrgFormat } from "@/lib/i18n/org-format";
import type { SiteOperationsData } from "@/lib/site-operations/load";

const EA_ATTRIBUTION = "Contains Environment Agency information © Environment Agency and/or database right.";

export function renderSiteOperationsHtml(d: SiteOperationsData & { orgName: string; format: OrgFormat; logoDataUri?: string }): string {
  const F = formatters(d.format);
  const L = (n: number | null | undefined) => (n == null ? "–" : F.number(n, 0));
  const table = (head: string[], rows: string[][]) =>
    `<table><tr>${head.map((h, i) => `<th${i > 0 ? ' class="num"' : ""}>${esc(h)}</th>`).join("")}</tr>${rows
      .map((r) => `<tr>${r.map((c, i) => `<td${i > 0 ? ' class="num"' : ""}>${esc(c)}</td>`).join("")}</tr>`)
      .join("")}</table>`;
  const section = (title: string, body: string, note?: string) => (body ? `<section><h2>${esc(title)}</h2>${body}${note ? `<p class="note">${esc(note)}</p>` : ""}</section>` : "");

  const stores = d.fuel.stores.length
    ? table(
        ["Store", "Fuel", "Litres in", "Litres out", "Last dip (L)", "Unaccounted (L)"],
        d.fuel.stores.map((s) => [s.store.name, s.store.fuelType, L(s.litresIn), L(s.litresOut), L(s.lastDip?.litres), s.variance == null ? "–" : `${L(s.variance)}${s.flagged ? " (check)" : ""}`]),
      )
    : "";
  const machines = d.fuel.machines.length
    ? table(
        ["Machine", "Issued (L)", "Telematics (L)", "Hours", "Idle share"],
        d.fuel.machines.map((m) => [m.label, L(m.issued), L(m.telematicsLitres), L(m.hours), m.idleShare == null ? "–" : F.percent(m.idleShare, 0)]),
      )
    : "";
  const sites = d.fuel.sites.length
    ? table(
        ["Site", "Delivered (L)", "Issued (L)", "Fuel on approved records (L)", "Gap (L)"],
        d.fuel.sites.map((s) => [s.siteName, L(s.delivered), L(s.issued), L(s.recorded), L(s.gap)]),
      )
    : "";
  const fuel = [stores, machines, sites].filter(Boolean).join("");

  const plant = d.plant.assets.length
    ? table(
        ["Machine", "Hours", "Idle share", "Fuel (L)", "L per hour", "HVO share", "kg CO₂e"],
        d.plant.assets.map((a) => [a.asset.name, L(a.hours), a.idleShare == null ? "–" : F.percent(a.idleShare, 0), L(a.fuelLitres), a.litresPerHour == null ? "–" : F.number(a.litresPerHour, 1), F.percent(a.hvoShare, 0), L(a.co2eKg)]),
      ) +
      (d.plant.reconciliation.length
        ? `<h3>Fuel burnt against fuel recorded</h3>` + table(["Site", "Burnt (L)", "Recorded (L)", "Gap (L)"], d.plant.reconciliation.map((r) => [r.siteName, L(r.telematicsLitres), L(r.recordedLitres), L(r.gapLitres)]))
        : "")
    : "";

  const movements = d.movements.length
    ? `<table><tr><th>Site</th><th>Material</th><th>EWC</th><th>Status</th><th class="num">Tonnes</th><th>Carrier</th><th>Open points</th></tr>${d.movements
        .map(
          (m) =>
            `<tr><td>${esc(m.site ?? "")}</td><td>${esc(m.material ?? "")}${m.hazardous ? " (hazardous)" : ""}</td><td>${esc(m.ewc ?? "")}</td><td>${esc(m.status)}</td><td class="num">${esc(F.number(m.tonnes, 1))}</td><td>${esc(m.carrier ?? "")}</td><td>${m.issues.length ? esc(m.issues.join("; ")) : "None"}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const docs = d.documents.length
    ? `<table><tr><th>Document</th><th>Issuer</th><th>Reference</th><th>Valid until</th><th>State</th></tr>${d.documents
        .map((x) => `<tr><td>${esc(x.title || x.kindLabel)}</td><td>${esc(x.issuer ?? "")}</td><td>${esc(x.reference ?? "")}</td><td>${x.validUntil ? esc(F.date(x.validUntil)) : "–"}</td><td>${esc(x.state)}</td></tr>`)
        .join("")}</table>`
    : "";
  const rc = d.registerChecks;
  const checks = rc.total
    ? `<p>${rc.total} register check${rc.total === 1 ? "" : "s"} made: ${rc.found} found in date, ${rc.problems} expired or not found. ${esc(EA_ATTRIBUTION)}</p>`
    : "";

  const swmp = d.swmp.length
    ? table(
        ["Project", "Status", "Target diversion", "Planned", "Actual", "Forecast (t)", "Recorded (t)", "Open checks"],
        d.swmp.map((p) => [p.project, `${p.status} v${p.version}`, p.targetPct == null ? "–" : `${F.number(p.targetPct, 0)}%`, p.plannedPct == null ? "–" : `${F.number(p.plannedPct, 0)}%`, p.actualPct == null ? "–" : `${F.number(p.actualPct, 0)}%`, F.number(p.forecastTonnes ?? 0, 1), F.number(p.actualTonnes ?? 0, 1), String(p.gaps)]),
      )
    : "";

  const body = [
    section("Fuel stores and issues", fuel, "A store's unaccounted litres compare its last dip with the previous dip plus deliveries less issues. A gap is a prompt to check for a missing entry, a leak or theft, not a finding."),
    section("Plant and idling", plant, "Hours and fuel come from telematics readings in the period. They are monitoring figures; the inventory comes from receipts and bills."),
    section("Hazardous and controlled material", movements, "Open points say what evidence is missing from a load. They do not say a load is lawful; the competent person confirms the rules for the site's nation."),
    section("Waste licences, permits and carrier checks", docs + checks, "The public register does not list which waste codes a permit covers, so a person still checks that the site may take each waste."),
    section("Site Waste Management Plans", swmp, "A plan is a record clients and tenders ask for. It is not a statutory requirement in England."),
  ].join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Site operations, ${esc(d.period.label)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1b2328; line-height: 1.45 }
  .head { background: #16323d; color: #fff; padding: 32px 40px 26px }
  .head .kicker { font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; margin-top: 12px }
  .head h1 { font-size: 22pt; font-weight: 700; margin: 4px 0 6px }
  .head .meta { font-size: 10pt; opacity: 0.8 }
  section { margin: 22px 40px }
  h2 { font-size: 13pt; color: #16323d; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #16323d }
  h3 { font-size: 11pt; color: #16323d; margin: 12px 0 4px }
  p { margin-bottom: 6px }
  .note { color: #4b5d63; font-size: 8.5pt }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 6px 0 10px }
  th { background: #e9f1f2; color: #16323d; text-align: left; padding: 4px 6px; border: 1px solid #cddcdf }
  td { padding: 4px 6px; border: 1px solid #dde6e8; vertical-align: top }
  .num { text-align: right; font-variant-numeric: tabular-nums }
  .empty { margin: 22px 40px; color: #4b5d63 }
  footer { font-size: 8pt; color: #6b7a7f; text-align: center; padding: 16px; border-top: 1px solid #dde6e8; margin-top: 26px }
  ${brandStyles()}
</style>
</head>
<body>
<div class="head">
  ${brandLogoHtml(d.logoDataUri)}
  <p class="kicker">Site operations</p>
  <h1>${esc(d.period.label)}</h1>
  <p class="meta">${esc(d.orgName)} · ${esc(F.date(d.period.from))} to ${esc(F.date(d.period.to))}</p>
</div>
${body || `<p class="empty">Nothing was recorded for fuel, plant, controlled material, waste documents or Site Waste Management Plans in this period.</p>`}
<footer>${esc(d.orgName)} · Read from the organisation's own records for the period · Nothing here is estimated</footer>
</body>
</html>`;
}
