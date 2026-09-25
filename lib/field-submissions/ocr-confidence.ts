/** Below this, a value the app read from the photo is flagged for the reviewer. */
export const LOW_OCR_CONFIDENCE = 0.6;

/** Keeps only `{ fieldName: number between 0 and 1 }` entries (at most 40). */
export function sanitiseOcrConfidence(input: unknown): Record<string, number> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>).slice(0, 40)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) continue;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n) && n >= 0 && n <= 1) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}

export type OcrFieldCheck = { key: string; ocr: string | null; submitted: string | null; confidence: number | null; edited: boolean; low: boolean };

/**
 * One row per field for the review screen: what OCR read, what was
 * submitted, how sure OCR was, and whether the reviewer should look first
 * (low confidence, or changed after OCR). Weakest first.
 */
export function ocrFieldChecks(ocrData: Record<string, unknown> | null, formData: Record<string, unknown> | null, ignored: Set<string>): OcrFieldCheck[] {
  const conf = sanitiseOcrConfidence(ocrData?.__confidence) ?? {};
  const keys = [...new Set([...Object.keys(ocrData ?? {}), ...Object.keys(formData ?? {})])].filter((k) => !ignored.has(k) && !k.startsWith("__"));
  const str = (v: unknown) => (v == null || v === "" ? null : typeof v === "object" ? JSON.stringify(v) : String(v));
  const rows = keys
    .map((key) => {
      const ocr = str(ocrData?.[key]);
      const submitted = str(formData?.[key]);
      if (ocr == null && submitted == null) return null;
      const confidence = ocr != null && key in conf ? conf[key] : null;
      const edited = ocr != null && submitted != null && ocr.trim().toLowerCase() !== submitted.trim().toLowerCase();
      return { key, ocr, submitted, confidence, edited, low: confidence != null && confidence < LOW_OCR_CONFIDENCE && !edited };
    })
    .filter((r): r is OcrFieldCheck => r !== null);
  const rank = (r: OcrFieldCheck) => (r.low ? 0 : r.edited ? 1 : r.confidence != null ? 2 : 3);
  return rows.sort((a, b) => rank(a) - rank(b) || (a.confidence ?? 1) - (b.confidence ?? 1));
}
