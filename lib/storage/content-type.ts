// Types a browser would run or render as a page. The bytes are kept; only the recorded type changes,
// so a stored file can never be served back under a type that executes in the app's origin.
const ACTIVE_CONTENT_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/xml",
  "application/xml",
  "text/javascript",
  "application/javascript",
  "application/ecmascript",
  "text/xsl",
  "application/xslt+xml",
]);

// Lower-cases, drops parameters. Malformed or active types are stored as a download.
export function storableContentType(contentType: string): string {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(type) || ACTIVE_CONTENT_TYPES.has(type)) {
    return "application/octet-stream";
  }
  return type;
}
