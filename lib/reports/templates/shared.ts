// Shared utilities, branding helpers, and SVG chart generators for all report templates.

export function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Print-friendly CSS + page numbers ────────────────────────────────────────
//
// All templates share these styles. Page numbers come from Puppeteer's
// displayHeaderFooter/footerTemplate (injected in renderPdf), but we also set
// CSS Paged Media counters as a fallback for other renderers.

export function brandStyles(): string {
  return `
  .brand-logo { max-height: 52px; max-width: 220px; margin-bottom: 10px; display: block; object-fit: contain; }
  .brand-name-fallback { font-size: 13pt; font-weight: 700; margin-bottom: 10px; opacity: 0.9; letter-spacing: -0.01em; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-before: always; }
    table { page-break-inside: auto; }
    tr, .bar-row, .meta, .total-card, .kpi-card { page-break-inside: avoid; }
    h1, h2 { page-break-after: avoid; }
    .chart-wrap { page-break-inside: avoid; }
  }
  @page {
    margin: 18mm 14mm 22mm;
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font-size: 8pt;
      color: #aaa;
    }
  }`;
}

// ── Logo or org-name fallback ─────────────────────────────────────────────────

export function brandLogoHtml(logoDataUri?: string, orgName?: string): string {
  if (logoDataUri) {
    return `<img class="brand-logo" src="${logoDataUri}" alt="${esc(orgName ?? "")} logo" />`;
  }
  if (orgName) {
    return `<div class="brand-name-fallback">${esc(orgName)}</div>`;
  }
  return "";
}

// ── SVG colour palette ────────────────────────────────────────────────────────

export const SCOPE_COLORS: Record<number, string> = {
  1: "#0f766e",  // teal-700
  2: "#0ea5e9",  // sky-500
  3: "#84cc16",  // lime-500
};

const PIE_FALLBACK_COLORS = [
  "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#f97316",
];

function pieColor(index: number, scope?: number): string {
  if (scope !== undefined && SCOPE_COLORS[scope]) return SCOPE_COLORS[scope];
  return PIE_FALLBACK_COLORS[index % PIE_FALLBACK_COLORS.length];
}

// ── SVG donut chart ───────────────────────────────────────────────────────────
//
// Renders a donut ring chart as an inline SVG. Each slice is drawn with the
// stroke-dasharray trick (no arc math). Accepts an array of slices with
// label, value (in kg or any unit), and optional scope number for colour.
//
// Returns an HTML string containing the SVG + a right-hand legend.

export interface DonutSlice {
  label: string;
  value: number;
  scope?: number;
}

export function svgDonut(
  slices: DonutSlice[],
  opts: {
    size?: number;      // SVG diameter in px (default 140)
    title?: string;     // centre label (e.g. "Scope split")
    unit?: string;      // unit string for legend values (default "tCO2e")
    formatValue?: (v: number) => string;
  } = {},
): string {
  const size = opts.size ?? 140;
  const r = size * 0.32;          // ring radius
  const cx = size / 2;
  const cy = size / 2;
  const stroke = size * 0.13;     // ring thickness
  const circ = 2 * Math.PI * r;
  const unit = opts.unit ?? "tCO2e";
  const fmt = opts.formatValue ?? ((v: number) => (v / 1000).toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return "";

  // Build circles (stroke-dasharray slices, rotated around the ring)
  let offset = 0; // cumulative angle offset as fraction of circumference
  const circles = slices.map((sl, i) => {
    const frac = sl.value / total;
    const dash = frac * circ;
    const gap = circ - dash;
    // Rotate so this slice starts where the previous ended. -90deg makes 12 o'clock the start.
    const rotateDeg = -90 + offset * 360;
    offset += frac;
    const color = pieColor(i, sl.scope);
    return `<circle
      cx="${cx}" cy="${cy}" r="${r}"
      fill="none"
      stroke="${color}"
      stroke-width="${stroke}"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      transform="rotate(${rotateDeg.toFixed(2)} ${cx} ${cy})"
    />`;
  }).join("\n");

  // Centre label
  const centreLabel = opts.title
    ? `<text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="${size * 0.085}" fill="#6b7280" font-family="Arial,sans-serif">${esc(opts.title)}</text>
       <text x="${cx}" y="${cy + size * 0.09}" text-anchor="middle" font-size="${size * 0.1}" fill="#111827" font-weight="700" font-family="Arial,sans-serif">${fmt(total)}</text>
       <text x="${cx}" y="${cy + size * 0.185}" text-anchor="middle" font-size="${size * 0.072}" fill="#9ca3af" font-family="Arial,sans-serif">${esc(unit)}</text>`
    : "";

  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <!-- track -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f3f4f6" stroke-width="${stroke}" />
    ${circles}
    ${centreLabel}
  </svg>`;

  // Legend
  const legendItems = slices.map((sl, i) => {
    const color = pieColor(i, sl.scope);
    const pct = total > 0 ? ((sl.value / total) * 100).toFixed(1) : "0.0";
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <div style="width:10px;height:10px;border-radius:2px;background:${color};flex-shrink:0;"></div>
      <span style="font-size:9pt;color:#374151;">${esc(sl.label)}</span>
      <span style="margin-left:auto;font-size:9pt;font-weight:600;color:#111827;white-space:nowrap;">${fmt(sl.value)} ${esc(unit)}</span>
      <span style="font-size:8pt;color:#9ca3af;white-space:nowrap;">(${pct}%)</span>
    </div>`;
  }).join("");

  return `<div class="chart-wrap" style="display:flex;align-items:center;gap:28px;margin:16px 0 24px;">
    <div style="flex-shrink:0;">${svg}</div>
    <div style="flex:1;min-width:0;">${legendItems}</div>
  </div>`;
}

// ── SVG horizontal bar chart ──────────────────────────────────────────────────
//
// Each bar is a labelled row. All bars scale relative to the largest value.

export interface BarItem {
  label: string;
  value: number;
  scope?: number;
  color?: string;
}

export function svgHBars(
  items: BarItem[],
  opts: {
    unit?: string;
    formatValue?: (v: number) => string;
    barHeight?: number;
    gap?: number;
  } = {},
): string {
  if (items.length === 0) return "";

  const unit = opts.unit ?? "tCO2e";
  const fmt = opts.formatValue ?? ((v: number) => (v / 1000).toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const barH = opts.barHeight ?? 16;
  const gap = opts.gap ?? 8;
  const maxVal = Math.max(...items.map((b) => b.value), 1);

  const LABEL_W_PCT = 28;  // % of container for label column
  const VALUE_W_PCT = 14;  // % for value column
  const BAR_W_PCT = 58;    // % for bar

  const rows = items.map((item, i) => {
    const color = item.color ?? pieColor(i, item.scope);
    const pct = (item.value / maxVal) * 100;
    const formatted = `${fmt(item.value)} ${unit}`;
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:${gap}px;min-width:0;">
      <div style="width:${LABEL_W_PCT}%;flex-shrink:0;font-size:8.5pt;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(item.label)}</div>
      <div style="width:${BAR_W_PCT}%;background:#f3f4f6;border-radius:3px;height:${barH}px;overflow:hidden;">
        <div style="width:${pct.toFixed(1)}%;height:100%;background:${color};border-radius:3px;transition:width 0s;"></div>
      </div>
      <div style="width:${VALUE_W_PCT}%;flex-shrink:0;font-size:8.5pt;font-weight:600;color:#111827;text-align:right;white-space:nowrap;">${formatted}</div>
    </div>`;
  }).join("");

  return `<div class="chart-wrap" style="margin:12px 0 20px;">${rows}</div>`;
}
