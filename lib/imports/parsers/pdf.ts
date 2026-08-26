import { createRequire } from "module";
import type { ParsedRow, ParseResult } from "../parser";

// ---------------------------------------------------------------------------
// PDF import parser
//
// Stage 1: pdf-parse extracts the text layer (works for digitally-generated
//   utility bills, delivery notes, etc.). If the result is substantial we
//   use it directly.
// Stage 2: Tesseract.js OCR — fallback for scanned/image-only PDFs.
//
// Both paths feed extractRowsFromText(), which applies regex heuristics for
// common UK document patterns (electricity, gas, water, fuel receipts).
// ---------------------------------------------------------------------------

// Lazy import so pdf-parse (@napi-rs/canvas) is only loaded when actually parsing PDFs.
// This prevents serverless environments from failing on non-PDF routes.
async function pdfParse(buffer: Buffer): Promise<{ text: string }> {
  const require = createRequire(import.meta.url);
  const pdfParseModule = require("pdf-parse") as (buffer: Buffer, options?: unknown) => Promise<{ text: string }>;
  return pdfParseModule(buffer);
}

// Lazy import so Tesseract's 2 MB WASM is only loaded when actually needed.
async function ocrText(buffer: Buffer): Promise<string> {
  const Tesseract = await import("tesseract.js");
  const worker = await Tesseract.createWorker("eng");
  try {
    const { data } = await worker.recognize(buffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// Category inference helpers
// ---------------------------------------------------------------------------

const PATTERNS = {
  electricity: /\b(kwh|kilowatt.hour|electricity)\b/i,
  gas:         /\b(gas|m3|cubic met(re|er)|calorific|therms?)\b/i,
  water:       /\b(water|m3|cubic met(re|er)|litres? of water)\b/i,
  fuel:        /\b(litre|liter|fuel|diesel|petrol|unleaded|HVO)\b/i,
};

function inferCategory(text: string): string {
  if (PATTERNS.electricity.test(text)) return "s2-electricity-lb";
  if (PATTERNS.gas.test(text))         return "s1-stationary";
  if (PATTERNS.water.test(text))       return "s3-purchased-goods"; // water placeholder
  if (PATTERNS.fuel.test(text))        return "s1-mobile";
  return "";
}

// ---------------------------------------------------------------------------
// Regex extraction — UK document patterns
// ---------------------------------------------------------------------------

interface ExtractedLine {
  category: string;
  amount: string;
  unit: string;
  description: string;
}

function extractLines(text: string): ExtractedLine[] {
  const results: ExtractedLine[] = [];

  // kWh readings: "Total usage: 1,234.56 kWh" or "1234 kWh"
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*k[Ww][Hh]/g)) {
    results.push({
      category: "s2-electricity-lb",
      amount: m[1].replace(/,/g, ""),
      unit: "kWh",
      description: "Electricity usage from PDF",
    });
  }

  // Gas in m³: "234.5 m3" or "234.5 m³"
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*m[3³]/g)) {
    results.push({
      category: "s1-stationary",
      amount: m[1].replace(/,/g, ""),
      unit: "m3",
      description: "Gas usage from PDF",
    });
  }

  // Fuel in litres: "50.00 litres" or "50.00 L"
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(?:litre[s]?|liter[s]?)\b/gi)) {
    results.push({
      category: "s1-mobile",
      amount: m[1].replace(/,/g, ""),
      unit: "litres",
      description: "Fuel from PDF",
    });
  }

  // Gas in kWh (dual-listed on UK bills)
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*k[Ww][Hh].*gas/gi)) {
    results.push({
      category: "s1-stationary",
      amount: m[1].replace(/,/g, ""),
      unit: "kWh",
      description: "Gas (kWh) from PDF",
    });
  }

  return results;
}

function linesToParseResult(lines: ExtractedLine[]): ParseResult {
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = ["category", "amount", "unit", "description"];
  const rows: ParsedRow[] = lines.map((l) => ({
    category: l.category,
    amount: l.amount,
    unit: l.unit,
    description: l.description,
  }));
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  // Stage 1: text-layer extraction
  try {
    const data = await pdfParse(buffer);
    if (data.text.trim().length > 80) {
      const lines = extractLines(data.text);
      if (lines.length > 0) {
        return linesToParseResult(lines);
      }
      // Text found but no recognisable patterns — fall through to OCR
      const categoryHint = inferCategory(data.text);
      if (categoryHint) {
        // Return the raw text as a single descriptive row so the worker can
        // map it manually rather than silently dropping the document.
        return {
          headers: ["category", "description"],
          rows: [{ category: categoryHint, description: data.text.slice(0, 500).replace(/\n/g, " ") }],
        };
      }
    }
  } catch {
    // pdf-parse can throw on encrypted or corrupt PDFs — fall through to OCR
  }

  // Stage 2: Tesseract OCR
  try {
    const text = await ocrText(buffer);
    const lines = extractLines(text);
    if (lines.length > 0) {
      return linesToParseResult(lines);
    }
    // OCR found text but no patterns — return hint row
    const categoryHint = inferCategory(text);
    if (categoryHint) {
      return {
        headers: ["category", "description"],
        rows: [{ category: categoryHint, description: text.slice(0, 500).replace(/\n/g, " ") }],
      };
    }
  } catch {
    // Tesseract failed — return empty so the worker marks the batch needs_attention
  }

  return { headers: [], rows: [] };
}
