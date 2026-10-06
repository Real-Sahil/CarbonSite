import { z } from "zod";

export const STORE_KINDS = ["bowser", "fixed_tank", "ibc"] as const;

export const storeBody = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.enum(STORE_KINDS),
  fuelType: z.string().trim().min(1).max(40).default("diesel"),
  capacityLitres: z.coerce.number().positive().max(10_000_000),
  ownership: z.enum(["owned", "hired"]).default("owned"),
  identifier: z.string().trim().max(100).nullish(),
  bunded: z.boolean().nullish(),
  lastInspectionOn: z.coerce.date().nullish(),
  siteId: z.string().min(1).nullish(),
  projectId: z.string().min(1).nullish(),
  onSiteFrom: z.coerce.date().nullish(),
  onSiteTo: z.coerce.date().nullish(),
  active: z.boolean().optional(),
});
export const storePatch = storeBody.partial();

const common = { storeId: z.string().min(1), on: z.coerce.date(), note: z.string().trim().max(500).nullish() };
const litres = z.coerce.number().positive().max(1_000_000);

export const entryBody = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("delivery"), ...common, litres,
    fuelType: z.string().trim().min(1).max(40),
    supplierName: z.string().trim().max(200).nullish(),
    reference: z.string().trim().max(100).nullish(),
    evidenceFileId: z.string().min(1).nullish(),
  }),
  z.object({
    kind: z.literal("issue"), ...common, litres,
    plantAssetId: z.string().min(1).nullish(),
    vehicleLabel: z.string().trim().max(120).nullish(),
    meterReading: z.coerce.number().nonnegative().max(10_000_000).nullish(),
  }),
  z.object({ kind: z.literal("dip"), ...common, litres: z.coerce.number().nonnegative().max(1_000_000) }),
]).refine((v) => v.kind !== "issue" || !!v.plantAssetId || !!v.vehicleLabel, { message: "Name the machine or the vehicle that took the fuel.", path: ["vehicleLabel"] });

export const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/** [first day, first day of next month) in UTC for a YYYY-MM string; defaults to the current month. */
export function monthRange(month?: string | null, now = new Date()) {
  const m = month && monthParam.safeParse(month).success ? month : now.toISOString().slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  return { month: m, from: new Date(Date.UTC(y, mo - 1, 1)), to: new Date(Date.UTC(y, mo, 1)) };
}
