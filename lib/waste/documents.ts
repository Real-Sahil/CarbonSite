/** Waste paper-trail documents: kinds, the validation of a new one and when one needs attention. */
import { z } from "zod";

export const DOC_KINDS = [
  { value: "transfer_note", label: "Waste transfer note" },
  { value: "carrier_licence", label: "Carrier licence" },
  { value: "site_permit", label: "Site permit" },
  { value: "exemption", label: "Exemption" },
  { value: "other", label: "Other" },
] as const;
export const KIND_VALUES = DOC_KINDS.map((k) => k.value) as [string, ...string[]];
export const kindLabel = (k: string) => DOC_KINDS.find((d) => d.value === k)?.label ?? k;

const date = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional());
const text = (n: number) => z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().trim().max(n).optional());

/** Fields a person (or a contractor, through a link) fills in beside the file. */
export const documentFieldsSchema = z.object({
  kind: z.enum(KIND_VALUES),
  title: text(160),
  reference: text(120),
  issuer: text(160),
  validUntil: date,
  note: text(500),
});

export type DocState = "expired" | "expiring" | "ok" | "no_date";

/** Licences and permits lapse; a transfer note is a record of one load and does not. */
export function documentState(kind: string, validUntil: Date | null, now = new Date()): DocState {
  if (kind === "transfer_note") return "no_date";
  if (!validUntil) return "no_date";
  const days = Math.floor((validUntil.getTime() - now.getTime()) / 86_400_000);
  return days < 0 ? "expired" : days <= 30 ? "expiring" : "ok";
}
