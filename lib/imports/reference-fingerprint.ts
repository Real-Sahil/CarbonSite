import { createHash } from "node:crypto";

/**
 * Identifies the reference rows an import validates against: categories by code,
 * facilities and business units by name (matched case-insensitively), each with its id.
 * Order does not matter; any added, removed, renamed or re-pointed row changes it.
 */
export function referenceFingerprint(reference: {
  categories: { code: string; id: string }[];
  facilities: { name: string; id: string }[];
  businessUnits: { name: string; id: string }[];
}): string {
  const entries = [
    ...reference.categories.map((c) => JSON.stringify(["category", c.code.toLowerCase(), c.id])),
    ...reference.facilities.map((f) => JSON.stringify(["facility", f.name.toLowerCase(), f.id])),
    ...reference.businessUnits.map((b) => JSON.stringify(["business-unit", b.name.toLowerCase(), b.id])),
  ].sort();
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}
