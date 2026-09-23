import { z } from "zod";
import { iso15143Snapshot, periodRow } from "./telematics";

export const MAX_ROWS = 5000;

export const telematicsBody = z.discriminatedUnion("format", [
  z.object({ format: z.literal("iso15143"), snapshot: iso15143Snapshot }),
  z.object({ format: z.literal("rows"), rows: z.array(periodRow).min(1).max(MAX_ROWS) }),
]);

export const assetBody = z.object({
  name: z.string().trim().min(1).max(200),
  assetCode: z.string().trim().max(60).nullish(),
  category: z.string().trim().max(60).nullish(),
  make: z.string().trim().max(100).nullish(),
  model: z.string().trim().max(100).nullish(),
  serialNumber: z.string().trim().max(100).nullish(),
  telematicsProvider: z.string().trim().max(100).nullish(),
  fuelType: z.string().trim().min(1).max(40).default("diesel"),
  ownership: z.enum(["owned", "hired"]).default("owned"),
  supplierName: z.string().trim().max(200).nullish(),
  siteId: z.string().min(1).nullish(),
  onHireFrom: z.coerce.date().nullish(),
  onHireTo: z.coerce.date().nullish(),
  active: z.boolean().optional(),
});
