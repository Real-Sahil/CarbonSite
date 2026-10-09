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
  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const num = iso ? null : raw.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/);
  let d: number, m: number, y: number;
  if (iso) {
    y = +iso[1]; m = +iso[2]; d = +iso[3];
  } else if (num) {
    d = +num[1]; m = +num[2]; y = +num[3];
    if (y < 100) y += 2000;
  } else {
    const txt = raw.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s\-]+([A-Za-z]{3})[a-z]*\.?,?[\s\-]+(\d{4})\b/);
    if (!txt) return null;
    d = +txt[1]; m = MONTHS.indexOf(txt[2].toLowerCase()) + 1; y = +txt[3];
    if (m === 0) return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const DATE_RE = String.raw`(\d{4}-\d{2}-\d{2}\b|\d{1,2}[\/.\-]\d{1,2}[\/.\-](?:\d{4}|\d{2})\b|\d{1,2}(?:st|nd|rd|th)?[\s\-]+[A-Za-z]{3,9}\.?,?[\s\-]+\d{4})`;

/** Between a label and its value: a short run of words, and at most one line break (forms print the label above the value). */
const GAP = String.raw`[^\n\d]{0,24}(?:\n[^\n\d]{0,12})?`;

const REF_LABEL = /(?:transfer note|consignment note|ticket|docket|wtn|note (?:no\.?|number)|\bref(?:erence)?\b)(?:\s+(?:no\.?|number|ref(?:erence)?|code|id|#))*\s*[:\-#]?\s*([A-Z0-9][A-Z0-9\-\/]{3,24})/gi;
const NOT_A_REF = /^(NOTE|NUMBER|REF|DATE|CODE|DETAILS|TICKET)$/i;

/**
 * The note's own reference. Labels come in many forms ("WTN No:", "Transfer note number", "Ticket No :", "Consignment
 * note code:", "Docket"), often with the value on the next line, so every label occurrence is tried until one is followed
 * by something with a digit. A token that starts WTN is its own reference ("WTN-2026-381"), never cut after the label.
 */
function findReference(t: string): string | null {
  const re = new RegExp(REF_LABEL.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    re.lastIndex = m.index + 1; // overlapping labels ("Waste Transfer Note" then "Transfer note number") must each get a turn
    const v = m[1];
    if (NOT_A_REF.test(v) || !/\d/.test(v)) continue;
    // "WTN-2026-381": the label matched "WTN" and the dash began the value, so take the whole token instead.
    if (/^wtn$/i.test(m[0].match(/wtn/i)?.[0] ?? "") && /wtn\s*-/i.test(t.slice(m.index, m.index + 5))) continue;
    return v.toUpperCase();
  }
  const bare = t.match(/\bWTN[-\s]?[A-Z0-9][A-Z0-9\-\/]{2,24}\b/i);
  if (bare && /\d/.test(bare[0])) return bare[0].replace(/\s+/g, "").toUpperCase();
  return null;
}

const CARRIER_WORDS = /\b(ltd|limited|plc|llp|haulage|waste|skip|skips|recycling|services|environmental|aggregates|plant|hire|transport|logistics|muck|group|contractors)\b/i;

/** The carrier's name: a labelled value (colon, dash or tab), cut before the next field; else a company-looking first line. */
function findCarrier(t: string): string | null {
  const labelled = t.match(/(?:registered |waste )?carrier(?:'s)?(?: name)?[ \t]*(?:[:\-\t]|\n)[ \t]*([^\n]{3,80})/i);
  if (labelled) {
    const v = labelled[1].replace(/(?<=[a-z]{3}\.)\s+(?=[A-Z])[\s\S]*/, "").replace(/\s+(?:registration|licen[cs]e|vehicle)\b.*/i, "").replace(/\s{2,}.*/, "").replace(/[.,;]+$/, "").trim();
    if (v.length >= 3 && !/^(licen|regist|details)/i.test(v)) return v;
  }
  const first = t.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  // A letterhead is a bare company name: a line with a colon is a labelled field ("Collected by: ...", "Date: ..."), never the letterhead.
  if (first && first.length <= 60 && !first.includes(":") && CARRIER_WORDS.test(first) && !/transfer note|weighbridge|consignment|ticket|invoice|quote|delivery/i.test(first)) {
    // A letterhead prints the company in capitals; keep its own spelling but tidy the case.
    return first === first.toUpperCase() ? first.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Ltd|Plc|Llp)\b/g, (c) => c) : first;
  }
  return null;
}

/** "17,430" is seventeen thousand four hundred and thirty; "1,5" is one and a half. A comma then three digits is thousands. */
function toNumber(raw: string, unit: string): number {
  if (/,\d{3}(?!\d)/.test(raw) && (/^kg/i.test(unit) || /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(raw))) return parseFloat(raw.replace(/,/g, ""));
  return parseFloat(raw.replace(",", "."));
}

const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)`;
const UNIT = String.raw`(tonnes?|tons?|t|kgs?|kg)\b`;

/** The load weight in tonnes. The net figure wins over gross and tare; then weight, quantity or load; then any figure with a unit. */
function findTonnes(t: string): number | null {
  const tries = [
    new RegExp(String.raw`\bnet(?:\s+(?:weight|wt|tonnage))?` + GAP + NUM + String.raw`\s*` + UNIT, "i"),
    new RegExp(String.raw`(?:weight|tonnage|quantity|load|qty)` + GAP + NUM + String.raw`\s*` + UNIT, "i"),
  ];
  for (const re of tries) {
    const m = t.match(re);
    if (m) return finish(m[1], m[2]);
  }
  // "Quantity (tonnes): 6.90": the unit is named in the label and the number carries none.
  const labelUnit = t.match(new RegExp(String.raw`(?:weight|tonnage|quantity|qty)\s*\(\s*(tonnes?|tons?|t|kgs?|kg)\s*\)` + GAP + NUM, "i"));
  if (labelUnit) return finish(labelUnit[2], labelUnit[1]);
  // Last resort: the first figure with a weight unit that is not a gross or tare line.
  for (const line of t.split("\n")) {
    if (/\b(gross|tare)\b/i.test(line)) continue;
    const m = line.match(new RegExp(NUM + String.raw`\s*` + UNIT, "i"));
    if (m) return finish(m[1], m[2]);
  }
  return null;
}
function finish(raw: string, unit: string): number | null {
  const v = toNumber(raw, unit);
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round((/^kg/i.test(unit) ? v / 1000 : v) * 1000) / 1000;
}

export function extractTransferNote(text: string): TransferNoteReading {
  const t = text.replace(/\r/g, "");
  const out: TransferNoteReading = { found: 0 };

  const reg = t.match(/\bCB(?:DU|DL|DS)?\s?-?\d{4,7}\b/i) ?? t.match(/\bCB\/[A-Z]{2}\d{4}[A-Z]{2}\b/i);
  if (reg) out.carrierRegistration = reg[0].toUpperCase().replace(/[\s-]/g, "");

  const permit = t.match(/\b(?:EPR\/)?[A-Z]{2}\d{4}[A-Z]{2}(?:\/[A-Z]\d{3})?\b/);
  if (t.match(/\bEPR\/[A-Z]{2}\d{4}[A-Z]{2}(?:\/[A-Z]\d{3})?\b/i)) out.permit = t.match(/\bEPR\/[A-Z]{2}\d{4}[A-Z]{2}(?:\/[A-Z]\d{3})?\b/i)![0].toUpperCase();
  else if (permit && /permit|licen[cs]e|exempt/i.test(t)) out.permit = permit[0];

  const ewcLabelled = t.match(/(?:EWC|LoW|list of waste|waste code)[^\n\d]{0,25}(\d{2}\s?\d{2}\s?\d{2}\s?\*?)/i);
  const ewcSpaced = t.match(/\b(\d{2} \d{2} \d{2}\s?\*?)/);
  const ewcRaw = (ewcLabelled ?? ewcSpaced)?.[1];
  if (ewcRaw) {
    const digits = ewcRaw.replace(/[^\d]/g, "");
    const chapter = +digits.slice(0, 2);
    if (digits.length === 6 && chapter >= 1 && chapter <= 20) out.ewc = `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)}${ewcRaw.includes("*") ? "*" : ""}`;
  }

  const ref = findReference(t);
  if (ref) out.reference = ref;

  const carrier = findCarrier(t);
  if (carrier) out.carrier = carrier;

  const veh = t.match(/\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b/);
  if (veh) out.vehicle = veh[0].replace(/\s/g, "");

  const tonnes = findTonnes(t);
  if (tonnes !== null) out.tonnes = tonnes;

  const expiry = t.match(new RegExp(String.raw`(?:expir(?:y|es|ation|ing)|valid (?:until|to)|renewal)` + GAP + DATE_RE, "i"));
  if (expiry) out.expiry = parseDate(expiry[1]) ?? undefined;
  const dated = t.match(new RegExp(String.raw`(?:date|collected|collection|tipped)` + GAP + DATE_RE, "i"));
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
