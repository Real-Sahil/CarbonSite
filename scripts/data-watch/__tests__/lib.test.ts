// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  calendarLastChecked,
  compareVersions,
  defraFlatFile,
  epaHubYear,
  latestDefraPublication,
  mergeSeries,
  parseBlsAnnual,
  parseDefraReleases,
  parseEurostatAnnual,
  parseOnsAnnual,
  readSeries,
  ukFootprintYear,
  writeSeries,
} from "../lib.mjs";

const root = path.resolve(__dirname, "../../..");
const priceIndex = readFileSync(path.join(root, "lib/calculation/price-index.ts"), "utf8");

describe("DEFRA", () => {
  it("reads the releases the build script knows", () => {
    const releases = parseDefraReleases(readFileSync(path.join(root, "scripts/build-defra-factors.mjs"), "utf8"));
    expect(releases.map((r) => r.year)).toEqual([2025, 2026]);
    expect(releases[1]).toMatchObject({ fileVersion: "1.2", library: "2026.1", published: "2026-07-10" });
  });

  it("finds the newest publication and its flat file", () => {
    const latest = latestDefraPublication({
      links: {
        documents: [
          { base_path: "/government/publications/greenhouse-gas-reporting-conversion-factors-2026", title: "GHG conversion factors 2026" },
          { base_path: "/government/publications/greenhouse-gas-reporting-conversion-factors-2027", title: "GHG conversion factors 2027" },
          { base_path: "/government/publications/something-else", title: "Other" },
        ],
      },
    });
    expect(latest).toMatchObject({ year: 2027 });
    expect(
      defraFlatFile({ details: { attachments: [{ title: "Full set" }, { title: "Conversion factors 2027: flat file (for automatic processing only)", url: "https://x/flat.xlsx" }] } }),
    ).toEqual({ title: "Conversion factors 2027: flat file (for automatic processing only)", url: "https://x/flat.xlsx" });
  });
});

describe("CPI parsing", () => {
  it("ONS annual values", () => {
    expect(parseOnsAnnual({ years: [{ year: "2025", value: "138.4" }, { year: "2026", value: "" }] })).toEqual({ 2025: 138.4 });
  });

  it("BLS: the annual average, else twelve months, else nothing", () => {
    const months = (year: string, n: number) => Array.from({ length: n }, (_, i) => ({ year, period: `M${String(i + 1).padStart(2, "0")}`, value: "100" }));
    const res = {
      Results: {
        series: [{ data: [{ year: "2025", period: "M13", value: "321.943" }, ...months("2025", 11), ...months("2024", 12), ...months("2026", 8)] }],
      },
    };
    expect(parseBlsAnnual(res)).toEqual({ 2025: 321.943, 2024: 100 });
  });

  it("Eurostat JSON-stat for one geo", () => {
    const js = {
      id: ["freq", "unit", "coicop", "geo", "time"],
      size: [1, 1, 1, 2, 2],
      dimension: {
        geo: { category: { index: { EA: 0, FR: 1 } } },
        time: { category: { index: { "2024": 0, "2025": 1 } } },
      },
      value: { "0": 126.07, "1": 128.75, "2": 123.29, "3": 124.43 },
    };
    expect(parseEurostatAnnual(js, "EA")).toEqual({ 2024: 126.07, 2025: 128.75 });
    expect(parseEurostatAnnual(js, "FR")).toEqual({ 2024: 123.29, 2025: 124.43 });
  });
});

describe("mergeSeries", () => {
  const table = { 2022: 121.7, 2023: 130.5, 2024: 133.9, 2025: 138.4 };

  it("adds new years when the source agrees", () => {
    expect(mergeSeries(table, { ...table, 2026: 142.1 }, "GBP")).toEqual({ series: { ...table, 2026: 142.1 }, added: [2026], rebased: false });
  });

  it("replaces a cleanly rebased series", () => {
    const rebased = Object.fromEntries(Object.entries({ ...table, 2026: 142.1 }).map(([y, v]) => [y, Math.round((v / 138.4) * 10000) / 100]));
    const out = mergeSeries(table, rebased, "EUR");
    expect(out.rebased).toBe(true);
    expect(out.series[2025]).toBe(100);
    expect(out.added).toEqual([2026]);
  });

  it("refuses a source that disagrees", () => {
    expect(() => mergeSeries(table, { ...table, 2024: 140 }, "GBP")).toThrow(/disagrees/);
  });
});

describe("price-index.ts rewrite", () => {
  it("reads and rewrites each series in place", () => {
    for (const key of ["GBP", "USD", "EUR", "FR"]) {
      const s = readSeries(priceIndex, key);
      expect(Object.keys(s).length).toBeGreaterThan(10);
      const next = writeSeries(priceIndex, key, { ...s, 2026: 150.5 }, "test note");
      expect(readSeries(next, key)).toEqual({ ...s, 2026: 150.5 });
      // Other series untouched.
      for (const other of ["GBP", "USD", "EUR", "FR"].filter((k) => k !== key)) expect(readSeries(next, other)).toEqual(readSeries(priceIndex, other));
      expect(next).toContain("// test note");
    }
  });
});

describe("other sources", () => {
  it("EPA hub year from the page links", () => {
    expect(epaHubYear('<a href="/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf">x</a> ghg_emission_factors_hub_2024.xlsx')).toBe(2025);
  });

  it("compares versions", () => {
    expect(compareVersions("v1.4.0", "1.3.0")).toBe(1);
    expect(compareVersions("1.3", "1.3.0")).toBe(0);
  });

  it("UK footprint year from the statistics page title", () => {
    expect(ukFootprintYear("UK and England's carbon footprint to 2023")).toBe(2023);
    expect(ukFootprintYear("Carbon footprint for the UK and England to 2024")).toBe(2024);
    expect(ukFootprintYear("UK and England's carbon footprint")).toBeNull();
  });

  it("reads the calendar's LAST_CHECKED", () => {
    const src = readFileSync(path.join(root, "app/(app)/orgs/[orgId]/compliance/deadlines/page.tsx"), "utf8");
    expect(calendarLastChecked(src)?.toISOString().slice(0, 10)).toBe("2026-09-26");
  });
});
