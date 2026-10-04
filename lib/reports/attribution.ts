// Attribution for the emission factor library a report's figures used.
// DEFRA/DESNZ conversion factors are Crown copyright under the Open
// Government Licence v3.0, which requires this attribution statement
// wherever the information is reused. EPA factors are a US Government work
// (public domain); attributing them is courtesy, not a condition. ADEME's
// Licence Ouverte v2.0 requires naming the source and its last update.

export type LibraryLicence = { name: string; version: string; license?: string | null; sourceUrl?: string | null };

export function factorAttribution(lib: LibraryLicence | null | undefined): string | null {
  if (!lib) return null;
  const licence = (lib.license ?? "").trim();
  if (/open government licen[cs]e/i.test(licence)) {
    return `Emission factors: ${lib.name} ${lib.version}. Contains public sector information licensed under the Open Government Licence v3.0.`;
  }
  if (/licence ouverte/i.test(licence)) {
    return `Emission factors: ${lib.name} ${lib.version} (source: ADEME, Base Carbone, updated ${lib.version}), reused under the Licence Ouverte v2.0 (Etalab).`;
  }
  if (/public domain/i.test(licence)) {
    // EPA publishes CH4 and N2O at the IPCC AR5 values; this platform's own gas-by-gas
    // calculations use AR6 (CH4 27.9, N2O 273), so say which basis the figures carry.
    const basis = /^EPA\b/i.test(lib.name) ? " Gases are combined at IPCC AR5 GWPs (CH4 28, N2O 265), EPA's published basis." : "";
    return `Emission factors: ${lib.name} ${lib.version}, a US Government work in the public domain.${basis}`;
  }
  return licence ? `Emission factors: ${lib.name} ${lib.version}, used under ${licence}.` : null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Adds the attribution as the last line of an HTML report (before </body>, or at the end). */
export function withAttribution(html: string, attribution: string | null): string {
  if (!attribution || !html) return html;
  const line = `<p style="font-size:8pt;color:#64748b;margin:12px 40px 16px;font-family:inherit">${esc(attribution)}</p>`;
  const i = html.lastIndexOf("</body>");
  return i >= 0 ? html.slice(0, i) + line + html.slice(i) : html + line;
}
