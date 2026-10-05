// Suggests an emission category for a ledger line (a supplier invoice line from
// the accounting system). Suggestions only: the person confirms each one, and
// anything the rules are unsure of goes to a "needs a look" list instead of being
// guessed. Pure and deterministic, no model call.
//
// Why a human stays in the loop: published research on spend classification puts
// even the best models at about 57% top-1 accuracy, so unattended classification
// would put wrong figures in a report. Why some lines are "needs a quantity":
// fuel, mains energy and waste are priced far better from litres, kWh and tonnes
// than from pounds, so the suggestion points the person at the bill instead of
// pricing the spend.

import { supplierKey } from "@/lib/social-value/local-spend";

export type LedgerBucket = "spend" | "needs_quantity" | "not_emissions" | "review";

export interface LedgerSuggestion {
  bucket: LedgerBucket;
  categoryCode: string | null;
  /** UK SIC 2007 group for the supplier's industry, where the rule knows one (spend factors use it). */
  industryCode: string | null;
  /** 0 to 1. Below LOW_CONFIDENCE the line is shown as "check this". */
  confidence: number;
  reason: string;
}

export const LOW_CONFIDENCE = 0.7;

/** The seeded emission categories a ledger line can be staged under. */
export const STAGEABLE_CATEGORIES = [
  "s1-stationary", "s1-mobile", "s1-fugitive", "s2-electricity-lb", "s2-heat",
  "s3-purchased-goods", "s3-capital-goods", "s3-fuel-energy", "s3-upstream-transport", "s3-waste",
  "s3-business-travel", "s3-commuting", "s3-upstream-leased", "s3-downstream-transport",
] as const;

type Rule = { re: RegExp; /** Words that count only in the description, since a supplier's trading name may contain them. */ desc?: RegExp; bucket: LedgerBucket; category: string | null; sic?: string; confidence: number; reason: string };

// First match wins, so the specific rules come before the general ones.
const RULES: Rule[] = [
  // Not emissions at all.
  { re: /\b(vat|hmrc|corporation tax|paye|payroll|salar(y|ies)|wages?|pension|bank (fee|charge)s?|loan|interest|dividend|director'?s? loan)\b/i, bucket: "not_emissions", category: null, confidence: 0.9, reason: "Tax, pay or finance: no emissions activity" },
  // Needs a quantity from the bill.
  { re: /\b(red diesel|gas ?oil|derv|diesel|petrol|unleaded|hvo|fuel card|fuelcard|certas|allstar|fuel)\b/i, bucket: "needs_quantity", category: "s1-mobile", confidence: 0.8, reason: "Fuel: use the litres from the invoice" },
  { re: /\b(npower|octopus|edf|e\.on|eon next|scottish power|ovo|british gas lite|utility warehouse)\b/i, desc: /\b(electricity|electric supply|half.?hourly)\b/i, bucket: "needs_quantity", category: "s2-electricity-lb", confidence: 0.85, reason: "Electricity: use the kWh from the bill" },
  { re: /\b(mains gas|natural gas|calor|lpg|propane|gas supply|heating oil|kerosene)\b/i, bucket: "needs_quantity", category: "s1-stationary", confidence: 0.8, reason: "Heating fuel: use the kWh or litres from the bill" },
  { re: /\b(skip hire|waste (collection|disposal|carrier)|biffa|veolia|suez|yorwaste|grundon|landfill|hazardous waste)\b/i, bucket: "needs_quantity", category: "s3-waste", confidence: 0.85, reason: "Waste: use the tonnes from the waste transfer note" },
  { re: /\b(refrigerant|f-?gas|air conditioning (service|top)|r410a|r134a)\b/i, bucket: "needs_quantity", category: "s1-fugitive", confidence: 0.75, reason: "Refrigerant top-up: use kg from the F-gas log" },
  // Spend is a reasonable basis.
  { re: /\b(ready.?mix|concrete|tarmac|cemex|hanson)\b/i, bucket: "spend", category: "s3-purchased-goods", sic: "23.63", confidence: 0.85, reason: "Concrete" },
  { re: /\b(reinforc|rebar|steel|celsa|tata steel|liberty steel)\b/i, bucket: "spend", category: "s3-purchased-goods", sic: "24.10", confidence: 0.85, reason: "Steel" },
  { re: /\b(aggregate|sand and gravel|quarry|stone|ballast|hardcore|mot type 1|sub.?base)\b/i, bucket: "spend", category: "s3-purchased-goods", sic: "08.12", confidence: 0.8, reason: "Aggregates" },
  { re: /\b(timber|plywood|sawmill|joinery)\b/i, bucket: "spend", category: "s3-purchased-goods", sic: "16.10", confidence: 0.8, reason: "Timber" },
  { re: /\b(brick|blockwork|roof tile|paving slab)\b/i, bucket: "spend", category: "s3-purchased-goods", sic: "23.32", confidence: 0.8, reason: "Bricks and blocks" },
  { re: /\b(asphalt|bitumen|road ?stone|macadam)\b/i, bucket: "spend", category: "s3-purchased-goods", sic: "23.99", confidence: 0.75, reason: "Asphalt and road materials" },
  { re: /\b(plant hire|equipment hire|excavator|telehandler|sunbelt|speedy|hss hire|ashtead|nationwide platforms)\b/i, bucket: "spend", category: "s3-purchased-goods", sic: "77.32", confidence: 0.8, reason: "Plant and equipment hire" },
  { re: /\b(subcontract|sub-contract|labour only|groundwork|scaffold|electrical contractor|mechanical contractor)\b/i, bucket: "spend", category: "s3-purchased-goods", confidence: 0.6, reason: "Subcontracted work" },
  { re: /\b(haulage|freight|courier|delivery charge|transport of|logistics|tipper|dhl|ups|fedex|dpd|royal mail)\b/i, bucket: "spend", category: "s3-upstream-transport", sic: "49.41", confidence: 0.75, reason: "Haulage and delivery" },
  { re: /\b(trainline|lner|avanti|gwr|eurostar|rail (ticket|fare|travel)s?|railcard|train (ticket|fare)s?|flights?|airline|easyjet|ryanair|british airways|taxi|uber(?! eats)|bolt|hotels?|accommodation|premier inn|travelodge|hilton (hotel|garden)|marriott (hotel|london)|car hire|hertz|avis|enterprise rent)\b/i, bucket: "spend", category: "s3-business-travel", confidence: 0.8, reason: "Business travel" },
  { re: /\b(office supplies|stationery|printing|printer|software|licence|subscription|telephone|mobile phone|broadband|insurance|accountan|legal fees|solicitor|consultan|recruitment|training course|marketing|advertis)\b/i, bucket: "spend", category: "s3-purchased-goods", confidence: 0.6, reason: "General purchased services" },
];

export interface LedgerLine {
  supplier: string;
  description: string;
}

/**
 * `learned` maps a normalised supplier name to the category the organisation has already used for it,
 * so a correction made once is applied to that supplier's later lines.
 */
export function suggestLedgerLine(line: LedgerLine, learned: ReadonlyMap<string, string> = new Map()): LedgerSuggestion {
  const key = supplierKey(line.supplier);
  const text = `${line.supplier} ${line.description}`;

  for (const r of RULES) {
    if (!r.re.test(text) && !r.desc?.test(line.description)) continue;
    if (r.bucket === "not_emissions") return { bucket: r.bucket, categoryCode: null, industryCode: null, confidence: r.confidence, reason: r.reason };
    // A supplier the organisation already files under a category keeps that category.
    const learnedCategory = learned.get(key);
    if (learnedCategory && r.bucket === "spend" && learnedCategory !== r.category) {
      return { bucket: "spend", categoryCode: learnedCategory, industryCode: null, confidence: 0.9, reason: `Same supplier is filed under ${learnedCategory} in your records` };
    }
    return { bucket: r.bucket, categoryCode: r.category, industryCode: r.sic ?? null, confidence: r.confidence, reason: r.reason };
  }

  const learnedCategory = learned.get(key);
  if (learnedCategory) {
    return { bucket: "spend", categoryCode: learnedCategory, industryCode: null, confidence: 0.9, reason: `Same supplier is filed under ${learnedCategory} in your records` };
  }
  return { bucket: "review", categoryCode: null, industryCode: null, confidence: 0, reason: "No rule matched: choose a category or leave it out" };
}
