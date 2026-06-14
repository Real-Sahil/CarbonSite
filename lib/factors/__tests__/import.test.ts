import { describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import { parseFactorWorkbook } from "../import";

const categories = [
  {
    activityType: "mobile_combustion",
    code: "s1-mobile",
    id: "cat_mobile",
    scope: 1,
  },
];

describe("parseFactorWorkbook", () => {
  test("parses validated factor rows", () => {
    const buffer = workbookBuffer([
      {
        scope: 1,
        emission_category_code: "s1-mobile",
        input_unit: "litre",
        co2e: "2.512",
        external_id: "DEFRA-2025-diesel",
        effective_start_date: "2025-01-01",
      },
    ]);

    const result = parseFactorWorkbook(buffer, "factors.xlsx", categories);

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      activityType: "mobile_combustion",
      emissionCategoryId: "cat_mobile",
      externalId: "DEFRA-2025-diesel",
      inputUnit: "litre",
      scope: 1,
    });
    expect(result.rows[0].co2e?.toString()).toBe("2.512");
  });

  test("rejects rows without factor values", () => {
    const buffer = workbookBuffer([
      { scope: 1, emission_category_code: "s1-mobile", input_unit: "litre" },
    ]);

    const result = parseFactorWorkbook(buffer, "factors.xlsx", categories);

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      "Row 2: provide at least one factor value: co2e, co2, ch4, or n2o.",
    ]);
  });

  test("rejects duplicate external ids in the uploaded file", () => {
    const buffer = workbookBuffer([
      { scope: 1, input_unit: "litre", co2e: "1", external_id: "factor-1" },
      { scope: 1, input_unit: "litre", co2e: "2", external_id: "Factor-1" },
    ]);

    const result = parseFactorWorkbook(buffer, "factors.xlsx", categories);

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      'Row 3: duplicate external_id "Factor-1" in upload.',
    ]);
  });
});

function workbookBuffer(rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Factors");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}
