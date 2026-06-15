import { describe, it, expect } from "vitest";
import { mapColumns, validateRow } from "../validator";

const CATEGORY_INDEX = new Map([
  ["s1-mobile", "cat-1"],
  ["s2-electricity-lb", "cat-2"],
  ["s3-upstream-transport", "cat-3"],
]);
const FACILITY_INDEX = new Map([["site a", "fac-1"]]);
const BU_INDEX = new Map([["operations", "bu-1"]]);

describe("mapColumns", () => {
  it("maps standard headers to canonical names", () => {
    const map = mapColumns(["Amount", "Unit", "Category Code", "Activity Date", "Facility", "Assumption Notes"]);
    expect(map.get("Amount")).toBe("amount");
    expect(map.get("Unit")).toBe("unit");
    expect(map.get("Category Code")).toBe("emissionCategoryCode");
    expect(map.get("Activity Date")).toBe("activityDate");
    expect(map.get("Facility")).toBe("facilityName");
    expect(map.get("Assumption Notes")).toBe("assumptionNotes");
  });

  it("is case-insensitive for canonical lookup", () => {
    const map = mapColumns(["AMOUNT", "uom", "category"]);
    expect(map.get("AMOUNT")).toBe("amount");
    expect(map.get("uom")).toBe("unit");
    expect(map.get("category")).toBe("emissionCategoryCode");
  });

  it("ignores unknown headers", () => {
    const map = mapColumns(["UnknownColumn", "AnotherBadOne"]);
    expect(map.size).toBe(0);
  });
});

describe("validateRow", () => {
  function makeColumnMap(headers: string[]) {
    return mapColumns(headers);
  }

  it("validates a fully correct row", () => {
    const headers = ["Amount", "Unit", "Category Code", "Activity Date", "Facility"];
    const colMap = makeColumnMap(headers);
    const row = {
      Amount: "100",
      Unit: "kWh",
      "Category Code": "s2-electricity-lb",
      "Activity Date": "2025-01-15",
      Facility: "Site A",
    };
    const { data, errors } = validateRow(row, colMap, CATEGORY_INDEX, FACILITY_INDEX, BU_INDEX);

    expect(errors).toHaveLength(0);
    expect(data.amount).toBe(100);
    expect(data.unit).toBe("kWh");
    expect(data.emissionCategoryId).toBe("cat-2");
    expect(data.activityDate).toBe("2025-01-15");
    expect(data.facilityId).toBe("fac-1");
  });

  it("errors when amount is missing", () => {
    const colMap = makeColumnMap(["Unit", "Category Code"]);
    const { errors } = validateRow(
      { Unit: "kWh", "Category Code": "s1-mobile" },
      colMap, CATEGORY_INDEX, FACILITY_INDEX, BU_INDEX,
    );
    expect(errors.some((e) => e.field === "amount")).toBe(true);
  });

  it("errors when amount is negative", () => {
    const colMap = makeColumnMap(["Amount", "Unit", "Category Code"]);
    const { errors } = validateRow(
      { Amount: "-50", Unit: "kWh", "Category Code": "s1-mobile" },
      colMap, CATEGORY_INDEX, FACILITY_INDEX, BU_INDEX,
    );
    expect(errors.some((e) => e.field === "amount")).toBe(true);
  });

  it("errors when amount has non-numeric value", () => {
    const colMap = makeColumnMap(["Amount", "Unit", "Category Code"]);
    const { errors } = validateRow(
      { Amount: "abc", Unit: "kWh", "Category Code": "s1-mobile" },
      colMap, CATEGORY_INDEX, FACILITY_INDEX, BU_INDEX,
    );
    expect(errors.some((e) => e.field === "amount")).toBe(true);
  });

  it("accepts comma-formatted numbers like 1,000", () => {
    const colMap = makeColumnMap(["Amount", "Unit", "Category Code"]);
    const { errors, data } = validateRow(
      { Amount: "1,000", Unit: "kWh", "Category Code": "s1-mobile" },
      colMap, CATEGORY_INDEX, FACILITY_INDEX, BU_INDEX,
    );
    expect(errors).toHaveLength(0);
    expect(data.amount).toBe(1000);
  });

  it("errors when unit is missing", () => {
    const colMap = makeColumnMap(["Amount", "Category Code"]);
    const { errors } = validateRow(
      { Amount: "100", "Category Code": "s1-mobile" },
      colMap, CATEGORY_INDEX, FACILITY_INDEX, BU_INDEX,
    );
    expect(errors.some((e) => e.field === "unit")).toBe(true);
  });

  it("errors when category code is unknown", () => {
    const colMap = makeColumnMap(["Amount", "Unit", "Category Code"]);
    const { errors } = validateRow(
      { Amount: "100", Unit: "kg", "Category Code": "unknown-code" },
      colMap, CATEGORY_INDEX, FACILITY_INDEX, BU_INDEX,
    );
    expect(errors.some((e) => e.field === "emissionCategoryCode")).toBe(true);
  });

  it("errors on invalid date format", () => {
    const colMap = makeColumnMap(["Amount", "Unit", "Category Code", "Activity Date"]);
    const { errors } = validateRow(
      { Amount: "100", Unit: "kWh", "Category Code": "s1-mobile", "Activity Date": "15/01/2025" },
      colMap, CATEGORY_INDEX, FACILITY_INDEX, BU_INDEX,
    );
    expect(errors.some((e) => e.field === "activityDate")).toBe(true);
  });

  it("warns (not errors) when facility name is not found", () => {
    const colMap = makeColumnMap(["Amount", "Unit", "Category Code", "Facility"]);
    const { errors, warnings } = validateRow(
      { Amount: "100", Unit: "kWh", "Category Code": "s1-mobile", Facility: "Nonexistent Site" },
      colMap, CATEGORY_INDEX, FACILITY_INDEX, BU_INDEX,
    );
    expect(errors).toHaveLength(0);
    expect(warnings.some((w) => w.field === "facilityName")).toBe(true);
  });

  it("resolves business unit by name", () => {
    const colMap = makeColumnMap(["Amount", "Unit", "Category Code", "Business Unit"]);
    const { data, warnings } = validateRow(
      { Amount: "100", Unit: "kWh", "Category Code": "s1-mobile", "Business Unit": "Operations" },
      colMap, CATEGORY_INDEX, FACILITY_INDEX, BU_INDEX,
    );
    expect(data.businessUnitId).toBe("bu-1");
    expect(warnings).toHaveLength(0);
  });
});
