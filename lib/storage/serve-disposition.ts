// Stored files are served from the app's own origin, so only types a browser can
// show safely inline. Anything else downloads; stored HTML or SVG never renders here.
const INLINE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

export function serveDisposition(contentType: string, filename: string): string {
  const type = (contentType.split(";")[0] ?? "").trim().toLowerCase();
  const mode = INLINE_TYPES.has(type) ? "inline" : "attachment";
  return `${mode}; filename="${filename.replaceAll('"', "")}"`;
}
