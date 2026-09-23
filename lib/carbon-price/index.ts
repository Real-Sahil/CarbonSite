// Internal carbon pricing (ESRS E1-8). Pure helpers; loaders in ./load.ts.
//
// E1-8 asks an undertaking that uses internal carbon pricing for: the type of
// scheme, where it is applied, the price per tonne with its critical
// assumptions and source, and the approximate GHG volume the scheme covers
// with its share of gross emissions. Everything the resolver and pages show
// comes from the organisation's own price rows and published figures.

export const PRICE_TYPES = {
  shadow: { label: "Shadow price", help: "A notional price added to investment and design appraisals. No money changes hands." },
  internal_fee: { label: "Internal fee", help: "A charge actually levied on business units or projects for their emissions." },
  implicit: { label: "Implicit price", help: "What the organisation already spends per tonne abated, derived from past decisions." },
} as const;
export type PriceType = keyof typeof PRICE_TYPES;

export const PRICE_USES = {
  capital_investment: "Capital investment appraisal",
  procurement: "Procurement and tender evaluation",
  operations: "Operational decisions",
  research: "Research and design options",
  product_pricing: "Product or service pricing",
  business_unit_charging: "Charging business units",
} as const;
export type PriceUse = keyof typeof PRICE_USES;

export type CarbonPrice = {
  id: string;
  name: string;
  priceType: string;
  pricePerTonne: number;
  currency: string;
  scopes: number[];
  appliesTo: string[];
  effectiveFrom: Date;
  effectiveTo: Date | null;
  basis: string | null;
};

const day = (d: Date) => d.toISOString().slice(0, 10);

/** The prices in force on `date`, most recently started first. */
export function pricesInForce<T extends Pick<CarbonPrice, "effectiveFrom" | "effectiveTo">>(prices: T[], date: Date): T[] {
  const on = day(date);
  return prices
    .filter((p) => day(p.effectiveFrom) <= on && (p.effectiveTo == null || day(p.effectiveTo) >= on))
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
}

/**
 * The price to apply for appraisal on `date`: a shadow price first (the one
 * meant for decisions), then an internal fee, then an implicit price.
 */
export function appraisalPrice<T extends CarbonPrice>(prices: T[], date: Date): T | null {
  const live = pricesInForce(prices, date);
  for (const type of ["shadow", "internal_fee", "implicit"]) {
    const hit = live.find((p) => p.priceType === type);
    if (hit) return hit;
  }
  return null;
}

export type ScopeTotal = { scope: number; tco2e: number };

/** Emissions a price covers, the cost at that price, and the share of the gross total. */
export function coveredCost(totals: ScopeTotal[], price: Pick<CarbonPrice, "scopes" | "pricePerTonne">) {
  const gross = totals.reduce((t, s) => t + s.tco2e, 0);
  const coveredTco2e = totals.filter((s) => price.scopes.includes(s.scope)).reduce((t, s) => t + s.tco2e, 0);
  return {
    coveredTco2e,
    grossTco2e: gross,
    share: gross > 0 ? coveredTco2e / gross : null,
    cost: coveredTco2e * price.pricePerTonne,
  };
}

/**
 * A MACC entry seen through the carbon price: what each tonne costs once the
 * avoided carbon is valued at the price, and whether the measure pays at it.
 * Only meaningful when the initiative costs and the price share a currency.
 */
export function netOfCarbonPrice(marginalCostPerTco2e: number, pricePerTonne: number) {
  const net = marginalCostPerTco2e - pricePerTonne;
  return { netCostPerTco2e: net, paysAtPrice: net <= 0 };
}

export const formatMoney = (amount: number, currency: string, dp = 0) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: dp, minimumFractionDigits: dp }).format(amount);

/** What E1-8 still needs from this organisation's prices; empty when it is answerable. */
export function e18Gaps(prices: CarbonPrice[], asOf: Date): string[] {
  const live = pricesInForce(prices, asOf);
  if (prices.length === 0) return ["No internal carbon price recorded. If you use none, E1-8 asks you to say so."];
  if (live.length === 0) return ["No internal carbon price is in force today."];
  const gaps: string[] = [];
  if (live.some((p) => !p.basis?.trim())) gaps.push("Record the critical assumptions and source of each price in force.");
  if (live.some((p) => p.appliesTo.length === 0)) gaps.push("Say which decisions each price in force is applied to.");
  if (live.some((p) => p.scopes.length === 0)) gaps.push("Say which scopes each price in force covers.");
  return gaps;
}
