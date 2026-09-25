/**
 * Reads the consumption line out of a utility bill or fuel receipt's text
 * (from a PDF text layer or OCR). Deterministic, no model calls: every value
 * comes with a confidence and the line it was read from, and the person
 * confirms it before a record is created.
 *
 * Bills list many quantities (meter readings, unit rates, last year's usage),
 * so a quantity only scores high when it sits on a consumption line
 * ("units used", "total consumption", "kWh used"); a lone quantity scores
 * medium; a guess among several scores low.
 */

export const BILL_EXTRACTOR_VERSION = "bill-extractor-v1";

export type BillKind = "electricity" | "gas" | "fuel" | "water" | "unknown";

export type Extracted<T> = { value: T; confidence: number; source?: string };

export type BillExtraction = {
  kind: BillKind;
  categoryCode: string | null;
  amount: Extracted<number> | null;
  unit: string | null;
  fuelType: Extracted<string> | null;
  supplier: Extracted<string> | null;
  invoiceNumber: Extracted<string> | null;
  periodStart: Extracted<string> | null;
  periodEnd: Extracted<string> | null;
  issueDate: Extracted<string> | null;
  /** Other quantities in the right unit, for the person to pick from. */
  alternatives: number[];
  notes: string[];
};

const SUPPLIERS = [
  "British Gas", "EDF", "E.ON Next", "E.ON", "Octopus Energy", "OVO", "Scottish Power", "ScottishPower", "SSE", "npower",
  "Ecotricity", "Good Energy", "Opus Energy", "ENGIE", "Crown Gas & Power", "Corona Energy", "TotalEnergies", "Total Gas & Power",
  "Yü Energy", "Yu Energy", "SmartestEnergy", "Drax", "Haven Power", "Pozitive Energy", "Utilita", "So Energy", "Shell Energy",
  "Shell", "BP", "Esso", "Texaco", "Jet", "Gulf", "Certas Energy", "Valero", "Harvest Energy", "Morrisons", "Tesco", "Sainsbury's", "Asda",
  "Anglian Water", "Thames Water", "Severn Trent", "United Utilities", "Yorkshire Water", "Northumbrian Water", "Southern Water", "Welsh Water", "Wessex Water", "South West Water", "Scottish Water",
];

const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;
const toNum = (s: string) => Number(s.replace(/,/g, ""));

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const DATE = String.raw`(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?\s+\d{4}|\d{4}-\d{2}-\d{2})`;

/** UK day-first dates to ISO (YYYY-MM-DD), or null. */
export function parseUkDate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, m[2].toLowerCase().startsWith("sept") ? 4 : 3).toLowerCase()];
    return mo ? valid(+m[3], mo, +m[1]) : null;
  }
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1) return null;
  return dt.toISOString().slice(0, 10);
}

function classify(text: string): BillKind {
  const t = text.toLowerCase();
  const fuel = /\b(diesel|petrol|unleaded|gas ?oil|red diesel|hvo|derv|adblue|kerosene|fuel)\b/.test(t) && /\b(litres?|liters?|ltrs?)\b|\d\s?l\b/.test(t);
  if (fuel) return "fuel";
  const water = /\bwater\b/.test(t) && /\b(m3|m³|cubic met)/.test(t) && !/\bgas\b/.test(t);
  if (water) return "water";
  const gas = /\bgas\b/.test(t) && /\b(kwh|m3|m³|therms?|calorific)\b/.test(t) && !/\belectricity\b/.test(t);
  if (gas) return "gas";
  if (/\b(electricity|kwh|day units|night units)\b/.test(t)) return "electricity";
  return "unknown";
}

const CONSUMPTION_LINE = /\b(units? used|total (?:units|consumption|usage|kwh|energy)|consumption|usage|energy used|kwh used|total used|quantity|volume)\b/i;
const NOT_CONSUMPTION = /\b(p\/kwh|pence|rate|price|£|per kwh|reading|previous|present|estimated reading|last year|same period|average|standing charge|annual)\b/i;

function pickQuantity(lines: string[], unitRe: RegExp): { value: number; confidence: number; source: string; alternatives: number[] } | null {
  const hits: { value: number; line: string; onConsumption: boolean; excluded: boolean }[] = [];
  for (const line of lines) {
    const re = new RegExp(NUM + String.raw`\s*` + unitRe.source, "gi");
    for (const m of line.matchAll(re)) {
      const v = toNum(m[1]);
      if (!(v > 0)) continue;
      hits.push({ value: v, line: line.trim(), onConsumption: CONSUMPTION_LINE.test(line), excluded: NOT_CONSUMPTION.test(line) });
    }
  }
  if (!hits.length) return null;
  const distinct = [...new Set(hits.map((h) => h.value))];
  const good = hits.filter((h) => h.onConsumption && !h.excluded);
  if (good.length) {
    const best = good.reduce((a, b) => (b.value > a.value ? b : a));
    return { value: best.value, confidence: new Set(good.map((g) => g.value)).size === 1 ? 0.9 : 0.75, source: best.line, alternatives: distinct.filter((v) => v !== best.value) };
  }
  const clean = hits.filter((h) => !h.excluded);
  const pool = clean.length ? clean : hits;
  const poolDistinct = [...new Set(pool.map((h) => h.value))];
  if (poolDistinct.length === 1) return { value: poolDistinct[0], confidence: 0.6, source: pool[0].line, alternatives: distinct.filter((v) => v !== poolDistinct[0]) };
  const best = pool.reduce((a, b) => (b.value > a.value ? b : a));
  return { value: best.value, confidence: 0.3, source: best.line, alternatives: distinct.filter((v) => v !== best.value) };
}

function findDate(text: string, label: RegExp): Extracted<string> | null {
  const re = new RegExp(label.source + String.raw`[^\n\d]{0,30}` + DATE, "i");
  const m = text.match(re);
  const iso = m ? parseUkDate(m[m.length - 1]) : null;
  return iso ? { value: iso, confidence: 0.8, source: m![0].trim() } : null;
}

export function extractBill(text: string): BillExtraction {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const kind = classify(text);
  const notes: string[] = [];

  let amount: BillExtraction["amount"] = null;
  let unit: string | null = null;
  let alternatives: number[] = [];
  let categoryCode: string | null = null;
  let fuelType: BillExtraction["fuelType"] = null;

  const take = (r: ReturnType<typeof pickQuantity>, u: string) => {
    if (!r) return;
    amount = { value: r.value, confidence: r.confidence, source: r.source };
    unit = u;
    alternatives = r.alternatives;
  };

  if (kind === "electricity") {
    categoryCode = "s2-electricity-lb";
    take(pickQuantity(lines, /kwh\b/), "kWh");
  } else if (kind === "gas") {
    categoryCode = "s1-stationary";
    const kwh = pickQuantity(lines, /kwh\b/);
    if (kwh) take(kwh, "kWh");
    else take(pickQuantity(lines, /(?:m3|m³)(?!\w)/), "m3");
  } else if (kind === "fuel") {
    categoryCode = "s1-mobile";
    take(pickQuantity(lines, /(?:litres?|liters?|ltrs?|l)\b/), "litres");
    const f = text.match(/\b(HVO\s?\d{0,3}|red diesel|gas ?oil|diesel|derv|unleaded|petrol|super unleaded|kerosene)\b/i);
    if (f) fuelType = { value: /derv/i.test(f[1]) ? "diesel" : f[1].toLowerCase().replace(/\s+/g, " "), confidence: 0.85, source: f[0] };
    if (/red diesel|gas ?oil/i.test(text)) notes.push("Red diesel or gas oil: check whether this is site plant (mobile) or a static generator.");
  } else if (kind === "water") {
    notes.push("This looks like a water bill. Water volumes go on the Water page, not as an emissions record.");
    const r = pickQuantity(lines, /(?:m3|m³)(?!\w)/);
    if (r) {
      amount = { value: r.value, confidence: r.confidence, source: r.source };
      unit = "m3";
    }
  } else {
    notes.push("Could not tell what kind of bill this is. Choose the category yourself.");
  }
  if (amount && (amount as Extracted<number>).confidence < 0.5) notes.push("Several quantities on this document. Check the one picked is the consumption for the period.");

  const lower = text.toLowerCase();
  const sup = SUPPLIERS.find((s) => lower.includes(s.toLowerCase()));
  const supplier = sup ? { value: sup.replace("ScottishPower", "Scottish Power").replace("Yu Energy", "Yü Energy"), confidence: 0.8 } : null;

  const inv = text.match(/\b(?:invoice|bill|receipt|transaction)\s*(?:no\.?|number|ref(?:erence)?|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{3,24})/i);
  const invoiceNumber = inv ? { value: inv[1], confidence: 0.75, source: inv[0].trim() } : null;

  let periodStart: Extracted<string> | null = null;
  let periodEnd: Extracted<string> | null = null;
  const range = text.match(new RegExp(String.raw`(?:period|from|billing period|supply period|covering)[^\n\d]{0,25}` + DATE + String.raw`\s*(?:-|–|to|until)\s*` + DATE, "i"));
  if (range) {
    const a = parseUkDate(range[1]);
    const b = parseUkDate(range[2]);
    if (a && b && a <= b) {
      periodStart = { value: a, confidence: 0.85, source: range[0].trim() };
      periodEnd = { value: b, confidence: 0.85, source: range[0].trim() };
    }
  }
  const issueDate = findDate(text, /\b(?:invoice date|bill date|date of issue|issue date|tax point|date)\b/);

  return { kind, categoryCode, amount, unit, fuelType, supplier, invoiceNumber, periodStart, periodEnd, issueDate, alternatives, notes };
}
