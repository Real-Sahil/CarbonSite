import { describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import { parseMaterialWorkbook } from "../import";

describe("parseMaterialWorkbook", () => {
  test("parses a validated material row with granular end-of-life data", () => {
    const buffer = workbookBuffer([
      {
        name: "Test Concrete Block",
        category: "concrete",
        gwp_a1_a3: "0.15",
        gwp_a4: "0.01",
        gwp_c1: "0.002",
        gwp_c2: "0.001",
        gwp_c3: "0.003",
        gwp_c4: "0.0005",
        replacement_cycle_years: "30",
        declared_unit: "kg",
        density: "2400",
      },
    ]);

    const result = parseMaterialWorkbook(buffer, "materials.xlsx");

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: "Test Concrete Block",
      category: "concrete",
      gwpA1A3: 0.15,
      gwpA4: 0.01,
      gwpC1: 0.002,
      gwpC2: 0.001,
      gwpC3: 0.003,
      gwpC4: 0.0005,
      replacementCycleYears: 30,
      declaredUnit: "kg",
      density: 2400,
      source: "ICE v3.0",
    });
  });

  test("requires name, category and gwp_a1_a3", () => {
    const buffer = workbookBuffer([{ name: "Missing fields" }]);

    const result = parseMaterialWorkbook(buffer, "materials.xlsx");

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      "Row 2: missing required columns category, gwp_a1_a3.",
    ]);
  });

  test("rejects a non-numeric gwp_a1_a3", () => {
    const buffer = workbookBuffer([
      { name: "Bad Value", category: "steel", gwp_a1_a3: "not-a-number" },
    ]);

    const result = parseMaterialWorkbook(buffer, "materials.xlsx");

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(["Row 2: gwp_a1_a3 must be a valid number."]);
  });

  test("rejects a negative gwp_a1_a3", () => {
    const buffer = workbookBuffer([
      { name: "Negative Value", category: "steel", gwp_a1_a3: "-1" },
    ]);

    const result = parseMaterialWorkbook(buffer, "materials.xlsx");

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(["Row 2: gwp_a1_a3 cannot be negative."]);
  });

  test("rejects an unknown declared_unit", () => {
    const buffer = workbookBuffer([
      { name: "Bad Unit", category: "steel", gwp_a1_a3: "1", declared_unit: "litre" },
    ]);

    const result = parseMaterialWorkbook(buffer, "materials.xlsx");

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      'Row 2: declared_unit must be one of kg, m3, m2 (got "litre").',
    ]);
  });

  test("rejects a non-integer replacement_cycle_years", () => {
    const buffer = workbookBuffer([
      { name: "Fractional Life", category: "steel", gwp_a1_a3: "1", replacement_cycle_years: "12.5" },
    ]);

    const result = parseMaterialWorkbook(buffer, "materials.xlsx");

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      "Row 2: replacement_cycle_years must be a whole number.",
    ]);
  });

  test("rejects duplicate names within one upload", () => {
    const buffer = workbookBuffer([
      { name: "Duplicate Material", category: "steel", gwp_a1_a3: "1" },
      { name: "Duplicate Material", category: "steel", gwp_a1_a3: "2" },
    ]);

    const result = parseMaterialWorkbook(buffer, "materials.xlsx");

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      'Row 3: duplicate material name "Duplicate Material" in upload.',
    ]);
  });

  test("remaps common column synonyms", () => {
    const buffer = workbookBuffer([
      {
        material_name: "Synonym Material",
        material_category: "timber",
        a1_a3: "0.4",
        eol: "0.02",
        replacement_years: "15",
      },
    ]);

    const result = parseMaterialWorkbook(buffer, "materials.xlsx");

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      name: "Synonym Material",
      category: "timber",
      gwpA1A3: 0.4,
      gwpC1C4: 0.02,
      replacementCycleYears: 15,
    });
  });

  test("defaults declared_unit to kg and source to ICE v3.0 when omitted", () => {
    const buffer = workbookBuffer([{ name: "Minimal Material", category: "misc", gwp_a1_a3: "0.5" }]);

    const result = parseMaterialWorkbook(buffer, "materials.xlsx");

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      declaredUnit: "kg",
      source: "ICE v3.0",
      replacementCycleYears: null,
      gwpC1: null,
    });
  });

  test("rejects an empty workbook", () => {
    const buffer = workbookBuffer([]);

    const result = parseMaterialWorkbook(buffer, "empty.xlsx");

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(["empty.xlsx does not contain any material rows."]);
  });
});

function workbookBuffer(rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Materials");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}
