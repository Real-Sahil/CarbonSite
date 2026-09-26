// Pure helpers for the data upkeep watchers (check.mjs) and the CPI updater
// (update-cpi.mjs). No network here, so everything is unit tested with
// fixtures in __tests__.

// ── DEFRA / DESNZ conversion factors ─────────────────────────────────────────

/** The releases scripts/build-defra-factors.mjs knows, from its RELEASES table. */
export function parseDefraReleases(scriptText) {
  const out = [];
  const re = /^\s{2}(\d{4}): \{\s*\n\s*fileVersion: "([^"]+)", library: "([^"]+)", published: "(\d{4}-\d{2}-\d{2})"/gm;
  for (const m of scriptText.matchAll(re)) out.push({ year: Number(m[1]), fileVersion: m[2], library: m[3], published: m[4] });
  return out.sort((a, b) => a.year - b.year);
}

/** Newest "greenhouse-gas-reporting-conversion-factors-<year>" publication in the GOV.UK collection. */
export function latestDefraPublication(collectionJson) {
  const docs = collectionJson?.links?.documents ?? [];
  let best = null;
  for (const d of docs) {
    const m = String(d.base_path ?? "").match(/greenhouse-gas-reporting-conversion-factors-(\d{4})$/);
    if (m && (!best || Number(m[1]) > best.year)) best = { year: Number(m[1]), basePath: d.base_path, title: d.title };
  }
  return best;
}

/** The flat file attachment of a conversion factors publication, from the GOV.UK content API. */
export function defraFlatFile(publicationJson) {
  const atts = publicationJson?.details?.attachments ?? [];
  const flat = atts.find((a) => /flat file/i.test(a.title ?? ""));
  return flat ? { title: flat.title, url: flat.url } : null;
}

// ── CPI series ───────────────────────────────────────────────────────────────

/** ONS time series JSON (…/timeseries/d7bt/mm23/data): annual values. */
export function parseOnsAnnual(json) {
  const out = {};
  for (const y of json?.years ?? []) {
    const year = Number(y.year), value = String(y.value ?? "").trim() === "" ? NaN : Number(y.value);
    if (Number.isInteger(year) && Number.isFinite(value)) out[year] = value;
  }
  return out;
}

/**
 * BLS API v2 response: the annual average (M13) where BLS gives one, else the
 * mean of twelve monthly values. A year with neither is incomplete and left out.
 */
export function parseBlsAnnual(json) {
  const byYear = new Map();
  for (const s of json?.Results?.series ?? []) {
    for (const d of s.data ?? []) {
      const e = byYear.get(d.year) ?? { months: [], m13: null };
      const v = String(d.value ?? "").trim() === "" ? NaN : Number(d.value);
      if (!Number.isFinite(v)) continue;
      if (d.period === "M13") e.m13 = v;
      else if (/^M(0[1-9]|1[0-2])$/.test(d.period)) e.months.push(v);
      byYear.set(d.year, e);
    }
  }
  const out = {};
  for (const [year, e] of byYear) {
    if (e.m13 != null) out[Number(year)] = e.m13;
    else if (e.months.length === 12) out[Number(year)] = Math.round((e.months.reduce((a, b) => a + b, 0) / 12) * 1000) / 1000;
  }
  return out;
}

/** Eurostat JSON-stat 2.0 (prc_hicp_aind, one unit and coicop): annual values for one geo. */
export function parseEurostatAnnual(json, geo) {
  const dims = json?.id ?? [];
  const size = json?.size ?? [];
  const index = (dim, code) => json?.dimension?.[dim]?.category?.index?.[code];
  const geoPos = index("geo", geo);
  if (geoPos == null) return {};
  const timeIdx = json.dimension.time.category.index;
  const out = {};
  for (const [year, tPos] of Object.entries(timeIdx)) {
    // Flat position: every dimension other than geo and time has one category.
    let flat = 0;
    for (let i = 0; i < dims.length; i++) {
      const pos = dims[i] === "geo" ? geoPos : dims[i] === "time" ? tPos : 0;
      flat = flat * size[i] + pos;
    }
    const v = json.value?.[flat] ?? json.value?.[String(flat)];
    if (v != null && v !== "" && Number.isFinite(Number(v))) out[Number(year)] = Number(v);
  }
  return out;
}

/**
 * Merge a freshly fetched series into the table's. Years the table has keep
 * their values when the source agrees (within 0.2%); new years are added.
 * When the source has been rebased (every shared year off by the same factor)
 * and covers every year in the table, the whole series is replaced, since
 * deflation only uses ratios within one series. Anything else throws: a person
 * must look.
 */
export function mergeSeries(table, fetched, label) {
  const shared = Object.keys(table).map(Number).filter((y) => fetched[y] != null);
  if (shared.length < 3) throw new Error(`${label}: the source shares fewer than 3 years with the table`);
  const agree = shared.every((y) => Math.abs(fetched[y] / table[y] - 1) < 0.002);
  if (agree) {
    const added = Object.keys(fetched).map(Number).filter((y) => table[y] == null && y > Math.max(...Object.keys(table).map(Number)));
    const merged = { ...table };
    for (const y of added) merged[y] = fetched[y];
    return { series: merged, added, rebased: false };
  }
  const factors = shared.map((y) => fetched[y] / table[y]);
  const f0 = factors[0];
  const rebased = factors.every((f) => Math.abs(f / f0 - 1) < 0.005);
  const coversAll = Object.keys(table).every((y) => fetched[y] != null);
  if (rebased && coversAll) {
    const minYear = Math.min(...Object.keys(table).map(Number));
    const series = Object.fromEntries(Object.entries(fetched).filter(([y]) => Number(y) >= minYear).map(([y, v]) => [Number(y), v]));
    const added = Object.keys(series).map(Number).filter((y) => table[y] == null);
    return { series, added, rebased: true };
  }
  const worst = shared.map((y) => [y, fetched[y], table[y]]).find(([, f, t]) => Math.abs(f / t - 1) >= 0.002);
  throw new Error(`${label}: the source disagrees with the table (e.g. ${worst[0]}: source ${worst[1]}, table ${worst[2]}) and is not a clean rebase`);
}

/** The object literal of years for one series in price-index.ts. */
function seriesBlockRegex(key) {
  // "  GBP: {" (CPI) or "  FR: {\n ... index: {" (COUNTRY_INDEX).
  return key === "FR"
    ? /(\n  FR: \{\n(?:    .*\n)*?    index: \{\n)((?:      .*\n)*?)(    \},)/
    : new RegExp(`(\\n  ${key}: \\{\\n)((?:    .*\\n)*?)(  \\},)`);
}

export function readSeries(source, key) {
  const m = source.match(seriesBlockRegex(key));
  if (!m) throw new Error(`price-index.ts: no ${key} series found`);
  const out = {};
  for (const [, y, v] of m[2].matchAll(/(\d{4}):\s*([\d.]+)/g)) out[Number(y)] = Number(v);
  return out;
}

export function writeSeries(source, key, series, note) {
  const re = seriesBlockRegex(key);
  const m = source.match(re);
  if (!m) throw new Error(`price-index.ts: no ${key} series found`);
  const indent = key === "FR" ? "      " : "    ";
  const years = Object.keys(series).map(Number).sort((a, b) => a - b);
  const lines = [];
  for (let i = 0; i < years.length; i += 6) {
    lines.push(indent + years.slice(i, i + 6).map((y) => `${y}: ${series[y]},`).join(" "));
  }
  const body = `${indent}// ${note}\n${lines.join("\n")}\n`;
  return source.replace(re, (_all, open, _old, close) => `${open}${body}${close}`);
}

// ── Other sources ────────────────────────────────────────────────────────────

/** Newest hub year linked from the EPA GHG Emission Factors Hub page. */
export function epaHubYear(html) {
  let best = null;
  for (const m of String(html).matchAll(/ghg[-_]emission[-_]factors[-_]hub[-_](\d{4})\.(?:pdf|xlsx)/gi)) {
    const y = Number(m[1]);
    if (!best || y > best) best = y;
  }
  return best;
}

/** "1.3.0" < "1.4" etc. */
export function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, "").split(".").map(Number);
  const pb = String(b).replace(/^v/i, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/** The year in "UK and England's carbon footprint to <year>" (GOV.UK statistics page title). */
export function ukFootprintYear(title) {
  const m = String(title ?? "").match(/carbon footprint (?:for the UK and England )?to (\d{4})/i);
  return m ? Number(m[1]) : null;
}

/** LAST_CHECKED from the regulatory calendar page, as a Date. */
export function calendarLastChecked(pageSource) {
  const m = pageSource.match(/const LAST_CHECKED = '(\d{1,2} \w+ \d{4})'/);
  if (!m) return null;
  const d = new Date(`${m[1]} 00:00:00 UTC`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const daysBetween = (a, b) => Math.floor((b.getTime() - a.getTime()) / 86_400_000);
