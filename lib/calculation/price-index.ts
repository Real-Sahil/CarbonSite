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
//   EUR: Eurostat HICP, euro area (EA, changing composition), all items,
//        2015 = 100, prc_hicp_aind (unit INX_A_AVG, coicop CP00)
//        https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_aind/default/table

const CPI: Record<string, Record<number, number>> = {
  GBP: {
    // Checked against ONS "Consumer price inflation" reference tables, Table 15a
    // (published 16 September 2026). 2012-2014 corrected from wrong values.
    2012: 96.1, 2013: 98.5, 2014: 100.0, 2015: 100.0, 2016: 100.7, 2017: 103.4,
    2018: 105.9, 2019: 107.8, 2020: 108.7, 2021: 111.6, 2022: 121.7, 2023: 130.5, 2024: 133.9,
    2025: 138.4,
  },
  // Checked against the BLS public API (series CUUR0000SA0, 24 September
  // 2026): 2012-2024 are the means of the twelve monthly values, and 2025 is
  // BLS's published annual average (period M13), which averages the eleven
  // months it published (there was no October 2025 figure).
  USD: {
    2012: 229.594, 2013: 232.957, 2014: 236.736, 2015: 237.017, 2016: 240.007, 2017: 245.12,
    2018: 251.107, 2019: 255.657, 2020: 258.811, 2021: 270.97, 2022: 292.655, 2023: 304.702, 2024: 313.689,
    2025: 321.943,
  },
  // Eurostat export of 6 February 2026 (data/sources/eurostat-prc_hicp_aind-EA-FR.csv).
  // The euro area series covers spend in euros from any member state.
  EUR: {
    2012: 98.05, 2013: 99.38, 2014: 99.81, 2015: 100.0, 2016: 100.23, 2017: 101.78,
    2018: 103.56, 2019: 104.8, 2020: 105.06, 2021: 107.78, 2022: 116.82, 2023: 123.15, 2024: 126.07,
    2025: 128.75,
  },
};

// A country's own index, used when the factor is priced in that country's
// economy (its geographyCountry), e.g. ADEME's French spend ratios. Same
// source file as EUR above (geo FR).
const COUNTRY_INDEX: Record<string, { currency: string; label: string; index: Record<number, number> }> = {
  FR: {
    currency: "EUR",
    label: "France HICP",
    index: {
      2012: 98.33, 2013: 99.31, 2014: 99.91, 2015: 100.0, 2016: 100.31, 2017: 101.47,
      2018: 103.6, 2019: 104.95, 2020: 105.5, 2021: 107.68, 2022: 114.04, 2023: 120.5, 2024: 123.29,
      2025: 124.43,
    },
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
export function deflateSpend(
  amount: number,
  currency: string,
  spendYear: number,
  priceYear: number,
  /** The factor's country; its own index is used when there is one for this currency. */
  country?: string | null,
): Deflation | null {
  const cur = currency.toUpperCase();
  const own = country ? COUNTRY_INDEX[country.toUpperCase()] : undefined;
  const useOwn = own != null && own.currency === cur;
  const index = useOwn ? own.index : CPI[cur];
  const label = useOwn ? own.label : cur === "EUR" ? "euro area HICP" : "CPI";
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
    note: `Adjusted ${spendYear} ${currency} spend to ${priceYear} prices (× ${ratio.toFixed(4)}, ${label}).`,
    warning: clamped.length
      ? `No ${currency} CPI figure yet for ${clamped.join(" and ")}; used ${clamped.map(clamp).join(" and ")} instead. The inflation adjustment is approximate until the index is updated.`
      : undefined,
  };
}
