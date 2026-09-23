// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildUseeioMigrationSql, parseUseeioCsv } from "../useeio";

const HEADER = '2017 NAICS Code,2017 NAICS Title,GHG,Unit,Supply Chain Emission Factors without Margins,Margins of Supply Chain Emission Factors,Supply Chain Emission Factors with Margins,Reference USEEIO Code';

describe("EPA USEEIO v1.3 import", () => {
  it("reads the with-margins factor by column name", () => {
    const csv = `﻿${HEADER}\r\n111110,Soybean Farming,All GHGs,"kg CO2e/2022 USD, purchaser price",0.9,0.03,0.93,1111A0\r\n236220,"Commercial and Institutional Building Construction",All GHGs,"kg CO2e/2022 USD, purchaser price",0.3,0.02,0.32,2332C0\r\n`;
    expect(parseUseeioCsv(csv)).toEqual([
      { naics: "111110", title: "Soybean Farming", kgCo2ePerUsd: 0.93 },
      { naics: "236220", title: "Commercial and Institutional Building Construction", kgCo2ePerUsd: 0.32 },
    ]);
  });

  it("refuses a file it does not recognise rather than guessing", () => {
    expect(() => parseUseeioCsv("code,value\n111110,0.9\n")).toThrow(/NAICS code column/);
    expect(() => parseUseeioCsv(`${HEADER}\n111110,X,All GHGs,kg CO2e/2012 USD,0.9,0.03,0.93,A\n`)).toThrow(/not kg CO2e per 2022 USD/);
    expect(() => parseUseeioCsv(`${HEADER}\n1111,X,All GHGs,kg CO2e/2022 USD,0.9,0.03,0.93,A\n`)).toThrow(/not 6 digits/);
    expect(() => parseUseeioCsv(`${HEADER}\n111110,X,All GHGs,kg CO2e/2022 USD,0.9,0.03,n/a,A\n`)).toThrow(/not a number/);
  });

  it("writes an additive migration with the 2022 price year and escaped titles", () => {
    const sql = buildUseeioMigrationSql([{ naics: "311811", title: "Retail Bakeries (incl. 'artisan')", kgCo2ePerUsd: 0.41 }], "f.csv");
    expect(sql).toContain("ON CONFLICT (\"name\", \"version\") DO NOTHING");
    expect(sql).toContain("'useeio-v1.3-naics6-311811', 'naics_311811', 0.41");
    expect(sql).toContain("''artisan''");
    expect(sql).toMatch(/'high', src\."usage_notes", 2022/);
    expect(sql).toContain("WHERE NOT EXISTS");
  });
});
