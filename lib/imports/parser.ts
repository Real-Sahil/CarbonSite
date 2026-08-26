import * as XLSX from "xlsx";
import { parsePdf } from "./parsers/pdf";

export type ParsedRow = Record<string, string>;
export type ParseResult = { headers: string[]; rows: ParsedRow[] };

export async function parseSpreadsheet(buffer: Buffer, filename: string): Promise<ParseResult> {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();

  if (ext === ".pdf") {
    return parsePdf(buffer);
  }

  let workbook: XLSX.WorkBook;
  if (ext === ".csv") {
    const text = buffer.toString("utf8");
    workbook = XLSX.read(text, { type: "string", raw: false, dateNF: "yyyy-mm-dd" });
  } else {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, dateNF: "yyyy-mm-dd" });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];

  const raw = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
    dateNF: "yyyy-mm-dd",
  });

  if (raw.length === 0) return { headers: [], rows: [] };

  const headers = (raw[0] as (string | null)[])
    .map((h) => String(h ?? "").trim())
    .filter((h) => h !== "");

  const rows: ParsedRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i] as (string | number | Date | null)[];
    if (cells.every((c) => c === null || c === "")) continue;

    const row: ParsedRow = {};
    headers.forEach((header, idx) => {
      const val = cells[idx];
      if (val instanceof Date) {
        row[header] = val.toISOString().slice(0, 10);
      } else {
        row[header] = String(val ?? "").trim();
      }
    });
    rows.push(row);
  }

  return { headers, rows };
}
