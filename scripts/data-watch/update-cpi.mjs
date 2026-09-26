// Brings the CPI tables in lib/calculation/price-index.ts up to date from the
// publishers' APIs, for deflating spend to a factor's price year:
//   GBP  ONS CPI index D7BT (2015 = 100)
//   USD  BLS CPI-U CUUR0000SA0 (1982-84 = 100); BLS_API_KEY optional
//   EUR  Eurostat HICP, euro area (prc_hicp_aind)
//   FR   Eurostat HICP, France (COUNTRY_INDEX)
//
//   node scripts/data-watch/update-cpi.mjs [--summary <file>]
//
// Only complete years are added. A published value that disagrees with the
// table stops the run (mergeSeries() in lib.mjs), except a clean rebase, which
// replaces the whole series. Run by .github/workflows/data-upkeep.yml, which
// opens a pull request with the change; nothing is committed here.
import { readFileSync, writeFileSync } from "node:fs";
import { mergeSeries, parseBlsAnnual, parseEurostatAnnual, parseOnsAnnual, readSeries, writeSeries } from "./lib.mjs";

const FILE = new URL("../../lib/calculation/price-index.ts", import.meta.url);
const UA = { "User-Agent": "MetricOra data upkeep (github.com/Real-Sahil/CarbonSite)" };
const today = new Date().toISOString().slice(0, 10);
const thisYear = new Date().getUTCFullYear();

async function json(url, init = {}) {
  const r = await fetch(url, { ...init, headers: { ...UA, Accept: "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return r.json();
}

async function fetchGbp() {
  return parseOnsAnnual(await json("https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7bt/mm23/data"));
}

async function fetchUsd() {
  // BLS v2 serves at most 10 years a request without a key (20 with one).
  const out = {};
  for (let start = 2012; start <= thisYear; start += 10) {
    const body = {
      seriesid: ["CUUR0000SA0"],
      startyear: String(start),
      endyear: String(Math.min(start + 9, thisYear)),
      annualaverage: true,
      ...(process.env.BLS_API_KEY ? { registrationkey: process.env.BLS_API_KEY } : {}),
    };
    const res = await json("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status !== "REQUEST_SUCCEEDED") throw new Error(`BLS: ${res.status} ${(res.message ?? []).join(" ")}`);
    Object.assign(out, parseBlsAnnual(res));
  }
  return out;
}

async function fetchEurostat() {
  // Eurostat moved HICP to COICOP 2018 in 2026; try the old and new codes.
  const base = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_aind?format=JSON&lang=EN&unit=INX_A_AVG&geo=EA&geo=FR&sinceTimePeriod=2012";
  const errors = [];
  for (const q of ["&coicop=CP00", "&coicop18=TOTAL", "&coicop=TOTAL"]) {
    try {
      const js = await json(base + q);
      const ea = parseEurostatAnnual(js, "EA"), fr = parseEurostatAnnual(js, "FR");
      if (Object.keys(ea).length && Object.keys(fr).length) return { EUR: ea, FR: fr };
      errors.push(`${q}: no values`);
    } catch (err) {
      errors.push(`${q}: ${err.message}`);
    }
  }
  throw new Error(`Eurostat: ${errors.join("; ")}`);
}

const SOURCES = {
  GBP: { label: "ONS CPI D7BT", fetch: fetchGbp },
  USD: { label: "BLS CPI-U CUUR0000SA0", fetch: fetchUsd },
  EUR: { label: "Eurostat HICP euro area (prc_hicp_aind)", fetch: null },
  FR: { label: "Eurostat HICP France (prc_hicp_aind)", fetch: null },
};

let source = readFileSync(FILE, "utf8");
const lines = [];
const failures = [];
let eurostat = null;

for (const [key, s] of Object.entries(SOURCES)) {
  try {
    const fetched = s.fetch ? await s.fetch() : (eurostat ??= await fetchEurostat())[key];
    // A year is complete only once it has ended.
    const complete = Object.fromEntries(Object.entries(fetched).filter(([y]) => Number(y) < thisYear));
    const table = readSeries(source, key);
    const { series, added, rebased } = mergeSeries(table, complete, key);
    if (!added.length && !rebased) {
      lines.push(`- ${key}: up to date (latest ${Math.max(...Object.keys(table).map(Number))})`);
      continue;
    }
    source = writeSeries(source, key, series, `Updated ${today} from ${s.label} by scripts/data-watch/update-cpi.mjs${rebased ? " (the source rebased the index; ratios are unchanged)" : ""}.`);
    lines.push(`- ${key}: ${rebased ? "series rebased by the source and replaced; " : ""}added ${added.map((y) => `${y} = ${series[y]}`).join(", ") || "no new years"}`);
  } catch (err) {
    failures.push(`- ${key}: ${err.message}`);
  }
}

writeFileSync(FILE, source);
const summary = [
  "CPI tables in `lib/calculation/price-index.ts`, checked against the publishers' APIs:",
  "",
  ...lines,
  ...(failures.length ? ["", "Could not update:", ...failures] : []),
].join("\n");
console.log(summary);
const at = process.argv.indexOf("--summary");
if (at > 0 && process.argv[at + 1]) writeFileSync(process.argv[at + 1], summary + "\n");
if (failures.length) process.exitCode = 1;
