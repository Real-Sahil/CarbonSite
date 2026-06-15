// HTML escaping shared by all templates

export function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── White-label branding + print-friendly CSS ────────────────────────────────
//
// All report templates share these so a customer's logo and print rules are
// consistent across every export. The logo is passed as a base64 data URI
// (resolved by the worker) because Puppeteer renders via setContent and a
// remote <img src> would not load reliably.

/// Styles for the header logo and print fidelity. Append inside each <style>.
export function brandStyles(): string {
  return `
  .brand-logo { max-height: 52px; max-width: 220px; margin-bottom: 10px; display: block; object-fit: contain; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-before: always; }
    table { page-break-inside: auto; }
    tr, .bar-row, .meta, .total-card { page-break-inside: avoid; }
    h1, h2 { page-break-after: avoid; }
  }`;
}

/// Header logo <img>, or empty string when the org has no logo set.
export function brandLogoHtml(logoDataUri?: string, orgName?: string): string {
  if (!logoDataUri) return "";
  return `<img class="brand-logo" src="${logoDataUri}" alt="${esc(orgName ?? "")} logo" />`;
}
