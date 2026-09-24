// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildUkSpendMigrationSql, groupPrefixes, parseUkSpendExtract } from "../uk-spend";

describe("Defra UK spend multipliers", () => {
  it("expands each group's code into the SIC prefixes it covers", () => {
    expect(groupPrefixes("1")).toEqual(["01"]);
    expect(groupPrefixes("10.2 -3")).toEqual(["102", "103"]);
    expect(groupPrefixes("11.01-6")).toEqual(["1101", "1102", "1103", "1104", "1105", "1106"]);
    expect(groupPrefixes("33.15")).toEqual(["3315"]);
    expect(groupPrefixes("20B")).toEqual(["2014", "2016", "2017", "2060"]);
    expect(groupPrefixes("42.99")).toEqual(["43"]);
    expect(groupPrefixes("68.2IMP")).toEqual([]);
    expect(() => groupPrefixes("XYZ")).toThrow(/Unrecognised/);
  });

  it("covers every SIC division once, with no group inside another (the published extract)", () => {
    const data = parseUkSpendExtract(readFileSync("data/sources/uk-spend-multipliers-sic-2015-2023.txt", "utf8"));
    expect(data.groups).toHaveLength(112);
    expect(data.years).toEqual([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]);
    const all = data.groups.flatMap((g) => groupPrefixes(g.code).map((p) => [p, g.code] as const));
    const overlaps = all.filter(([p, c]) => all.some(([p2, c2]) => c2 !== c && p2.startsWith(p)));
    expect(overlaps).toEqual([]);
    const divisions = new Set(all.map(([p]) => p.slice(0, 2)));
    for (const d of ["01", "10", "20", "41", "42", "43", "46", "62", "68", "96"]) expect(divisions.has(d)).toBe(true);
    expect(data.groups.find((g) => g.code === "41.2")?.values[2023]).toBeGreaterThan(0);
  });

  it("writes one factor per group and year, each effective for its year at its own prices", () => {
    const sql = buildUkSpendMigrationSql(
      { years: [2022, 2023], groups: [{ code: "41.2", title: "Buildings and building construction works", values: { 2022: 0.3, 2023: 0.28 } }, { code: "68.2IMP", title: "Imputed rent", values: { 2022: 0.1, 2023: 0.1 } }] },
      "x.txt",
    );
    expect(sql).toContain("('uk-spend-sic-41.2-2022', 'uksic_41.2', 0.3, 2022, NULL::date, DATE '2022-12-31'");
    expect(sql).toContain("('uk-spend-sic-41.2-2023', 'uksic_41.2', 0.28, 2023, DATE '2023-01-01', NULL::date");
    expect(sql).not.toContain("68.2IMP-2022");
    expect(sql).toContain("'GB',\n       'GBP'");
    expect(sql).toContain("WHERE NOT EXISTS");
  });

  it("refuses a malformed extract", () => {
    expect(() => parseUkSpendExtract("# Columns: SIC code | SIC category | 2023\n41.2|Buildings\n")).toThrow(/expected 3 fields/);
    expect(() => parseUkSpendExtract("# Columns: SIC code | SIC category | 2023\n41.2|Buildings|n/a\n")).toThrow(/not a number/);
  });
});
