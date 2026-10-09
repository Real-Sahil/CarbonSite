/**
 * Reads the text of a waste transfer note, carrier licence or permit and
 * suggests the fields a person would type: reference, carrier, carrier
 * registration, permit number, EWC code, weight, date, vehicle, expiry.
 * Deterministic patterns only, no model. Everything is a suggestion: the page
 * shows it and a person applies it. A field that is not clearly present is left out.
 */
export const TRANSFER_NOTE_EXTRACTOR_VERSION = "wtn-1";

export type TransferNoteReading = {
  reference?: string;
  carrier?: string;
  carrierRegistration?: string;
  permit?: string;
  ewc?: string;
  tonnes?: number;
  date?: string; // ISO yyyy-mm-dd
  vehicle?: string;
  expiry?: string; // ISO yyyy-mm-dd
  found: number;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy or "12 Mar 2026" to ISO, or null. UK day-first. */
export function parseDate(raw: string): string | null {
  const num = raw.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/);
  let d: number, m: number, y: number;
  if (num) {
    d = +num[1]; m = +num[2]; y = +num[3];
    if (y < 100) y += 2000;
  } else {
    const txt = raw.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})\b/);
    if (!txt) return null;
    d = +txt[1]; m = MONTHS.indexOf(txt[2].toLowerCase()) + 1; y = +txt[3];
    if (m === 0) return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const DATE_RE = String.raw`(\d{1,2}[\/.\-]\d{1,2}[\/.\-](?:\d{4}|\d{2})\b|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?,?\s+\d{4})`;

export function extractTransferNote(text: string): TransferNoteReading {
  const t = text.replace(/\r/g, "");
  const out: TransferNoteReading = { found: 0 };

  const reg = t.match(/\bCB(?:DU|DL|DS)?\s?-?\d{4,7}\b/i) ?? t.match(/\bCB\/[A-Z]{2}\d{4}[A-Z]{2}\b/i);
  if (reg) out.carrierRegistration = reg[0].toUpperCase().replace(/[\s-]/g, "");

  const permit = t.match(/\b(?:EPR\/)?[A-Z]{2}\d{4}[A-Z]{2}(?:\/[A-Z]\d{3})?\b/);
  if (t.match(/\bEPR\/[A-Z]{2}\d{4}[A-Z]{2}(?:\/[A-Z]\d{3})?\b/i)) out.permit = t.match(/\bEPR\/[A-Z]{2}\d{4}[A-Z]{2}(?:\/[A-Z]\d{3})?\b/i)![0].toUpperCase();
  else if (permit && /permit|licen[cs]e|exempt/i.test(t)) out.permit = permit[0];

  const ewcLabelled = t.match(/(?:EWC|LoW|list of waste)[^\n\d]{0,25}(\d{2}\s?\d{2}\s?\d{2}\s?\*?)/i);
  const ewcSpaced = t.match(/\b(\d{2} \d{2} \d{2}\s?\*?)/);
  const ewcRaw = (ewcLabelled ?? ewcSpaced)?.[1];
  if (ewcRaw) {
    const digits = ewcRaw.replace(/[^\d]/g, "");
    const chapter = +digits.slice(0, 2);
    if (digits.length === 6 && chapter >= 1 && chapter <= 20) out.ewc = `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)}${ewcRaw.includes("*") ? "*" : ""}`;
  }

  const ref = t.match(/(?:\bwtn\b|transfer note|consignment note|ticket|docket)\s*(?:no\.?|number|ref(?:erence)?|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{3,24})/i);
  if (ref && /\d/.test(ref[1]) && !/^(NOTE|NUMBER|REF)$/i.test(ref[1])) out.reference = ref[1].toUpperCase();

  const carrier = t.match(/carrier(?:'s)?(?: name)?\s*[:\-]\s*([^\n]{3,60})/i);
  if (carrier) out.carrier = carrier[1].replace(/\s{2,}.*/, "").trim();

  const veh = t.match(/\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b/);
  if (veh) out.vehicle = veh[0].replace(/\s/g, "");

  const net = t.match(/(?:net|weight|tonnage|quantity)[^\n\d]{0,20}(\d+(?:[.,]\d+)?)\s*(tonnes?|tons?|t|kgs?|kg)\b/i) ?? t.match(/(\d+(?:[.,]\d+)?)\s*(tonnes?|kgs?|kg)\b/i);
  if (net) {
    const v = parseFloat(net[1].replace(",", "."));
    const kg = /^kg/i.test(net[2]);
    if (Number.isFinite(v) && v > 0) out.tonnes = Math.round((kg ? v / 1000 : v) * 1000) / 1000;
  }

  const expiry = t.match(new RegExp(String.raw`(?:expir(?:y|es|ation|ing)|valid (?:until|to)|renewal)[^\n\d]{0,20}` + DATE_RE, "i"));
  if (expiry) out.expiry = parseDate(expiry[1]) ?? undefined;
  const dated = t.match(new RegExp(String.raw`(?:date|collected|collection|tipped)[^\n\d]{0,20}` + DATE_RE, "i"));
  if (dated) out.date = parseDate(dated[1]) ?? undefined;

  out.found = ["reference", "carrier", "carrierRegistration", "permit", "ewc", "tonnes", "date", "vehicle", "expiry"].filter((k) => out[k as keyof TransferNoteReading] !== undefined).length;
  return out;
}

/** The blank fields of a document that a reading can fill, by kind. Never overwrites anything typed. */
export function suggestedFill(
  kind: string,
  doc: { reference: string | null; issuer: string | null; validUntil: Date | null },
  r: TransferNoteReading,
): { reference?: string; issuer?: string; validUntil?: string } {
  const out: { reference?: string; issuer?: string; validUntil?: string } = {};
  const ref = kind === "transfer_note" ? r.reference : kind === "carrier_licence" ? r.carrierRegistration : kind === "site_permit" || kind === "exemption" ? r.permit : undefined;
  if (!doc.reference && ref) out.reference = ref;
  if (!doc.issuer && r.carrier && (kind === "transfer_note" || kind === "carrier_licence")) out.issuer = r.carrier;
  if (!doc.validUntil && r.expiry && kind !== "transfer_note") out.validUntil = r.expiry;
  return out;
}
