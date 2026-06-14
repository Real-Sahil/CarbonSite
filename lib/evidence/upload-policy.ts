export const EVIDENCE_MAX_BYTES = 25 * 1024 * 1024;

export const EVIDENCE_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const EVIDENCE_ACCEPT_ATTRIBUTE = EVIDENCE_ALLOWED_MIME_TYPES.join(",");

const ALLOWED_MIME_TYPE_SET = new Set<string>(EVIDENCE_ALLOWED_MIME_TYPES);

export function isAllowedEvidenceMimeType(contentType: string) {
  return ALLOWED_MIME_TYPE_SET.has(normalizeMimeType(contentType));
}

export function normalizeMimeType(contentType: string) {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isAllowedEvidenceSize(byteSize: number) {
  return Number.isInteger(byteSize) && byteSize > 0 && byteSize <= EVIDENCE_MAX_BYTES;
}
