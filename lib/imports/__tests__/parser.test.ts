import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSpreadsheet } from "../parser";

function makeCsvBuffer(content: string): Buffer {
  return Buffer.from(content, "utf8");
}

function makeXlsxBuffer(rows: (string | number)[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

describe("parseSpreadsheet", () => {
  it("parses a valid CSV with headers and data rows", async () => {
    const csv = `Amount,Unit,Category Code,Activity Date
100,kWh,s2-electricity-lb,2025-01-15
200,litres,s1-mobile,2025-02-01`;
    const { headers, rows } = await parseSpreadsheet(makeCsvBuffer(csv), "test.csv");

    expect(headers).toEqual(["Amount", "Unit", "Category Code", "Activity Date"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]["Amount"]).toBe("100");
    expect(rows[0]["Unit"]).toBe("kWh");
    expect(rows[1]["Category Code"]).toBe("s1-mobile");
  });

  it("skips entirely blank rows", async () => {
    const csv = `Amount,Unit,Category Code
100,kWh,s2-electricity-lb
,,
200,litres,s1-mobile`;
    const { rows } = await parseSpreadsheet(makeCsvBuffer(csv), "test.csv");
    expect(rows).toHaveLength(2);
  });

  it("returns empty rows for a header-only CSV", async () => {
    const { headers, rows } = await parseSpreadsheet(makeCsvBuffer("Amount,Unit,Category Code\n"), "test.csv");
    expect(headers).toHaveLength(3);
    expect(rows).toHaveLength(0);
  });

  it("returns empty for an empty buffer", async () => {
    const { headers, rows } = await parseSpreadsheet(makeCsvBuffer(""), "test.csv");
    expect(headers).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });

  it("parses an XLSX buffer", async () => {
    const buffer = makeXlsxBuffer([
      ["Amount", "Unit", "Category Code"],
      [500, "kg", "s3-upstream-transport"],
    ]);
    const { headers, rows } = await parseSpreadsheet(buffer, "data.xlsx");

    expect(headers).toContain("Amount");
    expect(rows).toHaveLength(1);
    expect(rows[0]["Amount"]).toBe("500");
    expect(rows[0]["Category Code"]).toBe("s3-upstream-transport");
  });

  it("trims whitespace from headers and cell values", async () => {
    const csv = `  Amount  ,  Unit  \n  100  ,  kWh  `;
    const { headers, rows } = await parseSpreadsheet(makeCsvBuffer(csv), "test.csv");
    expect(headers[0]).toBe("Amount");
    expect(rows[0]["Amount"]).toBe("100");
  });
});
