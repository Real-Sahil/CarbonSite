// Consumer price indices for adjusting spend to a factor's price year.
//
// A spend-based (EEIO) factor is "kg CO2e per unit of currency at year-Y
// prices". Spend from a later year buys less, so it must be deflated to year Y
// before the factor applies; otherwise inflation alone inflates the emissions.
//
//   spend at year-Y prices = spend × CPI(Y) / CPI(spend year)
//
// Annual averages. Update each year when the new annual figure is published.
//   GBP: ONS CPI index, 2015 = 100, series D7BT
//        https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7bt/mm23
//   USD: BLS CPI-U, US city average, all items, 1982-84 = 100, series CUUR0000SA0
//        https://data.bls.gov/timeseries/CUUR0000SA0

const CPI: Record<string, Record<number, number>> = {
  GBP: {
    2012: 93.1, 2013: 95.5, 2014: 96.9, 2015: 100.0, 2016: 100.7, 2017: 103.4,
    2018: 105.9, 2019: 107.8, 2020: 108.7, 2021: 111.6, 2022: 121.7, 2023: 130.5, 2024: 133.9,
  },
  USD: {
    2012: 229.594, 2013: 232.957, 2014: 236.736, 2015: 237.017, 2016: 240.007, 2017: 245.12,
    2018: 251.107, 2019: 255.657, 2020: 258.811, 2021: 270.97, 2022: 292.655, 2023: 304.702, 2024: 313.689,
  },
};

export type Deflation = {
  amount: number;
  /** Multiplier applied: CPI(price year) / CPI(spend year). */
  ratio: number;
  note: string;
  warning?: string;
};

/**
 * Express `amount` of `currency` spent in `spendYear` at `priceYear` prices.
 * Null when there is no index for the currency. A year outside the table uses
 * the nearest published year and says so.
 */
export function deflateSpend(amount: number, currency: string, spendYear: number, priceYear: number): Deflation | null {
  const index = CPI[currency.toUpperCase()];
  if (!index) return null;
  const years = Object.keys(index).map(Number);
  const [first, last] = [Math.min(...years), Math.max(...years)];
  const clamp = (y: number) => Math.min(last, Math.max(first, y));
  const [s, p] = [clamp(spendYear), clamp(priceYear)];
  const ratio = index[p] / index[s];
  const clamped = [spendYear, priceYear].filter((y) => y !== clamp(y));
  return {
    amount: amount * ratio,
    ratio,
    note: `Adjusted ${spendYear} ${currency} spend to ${priceYear} prices (× ${ratio.toFixed(4)}, CPI).`,
    warning: clamped.length
      ? `No ${currency} CPI figure yet for ${clamped.join(" and ")}; used ${clamped.map(clamp).join(" and ")} instead. The inflation adjustment is approximate until the index is updated.`
      : undefined,
  };
}
