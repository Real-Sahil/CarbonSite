import { z } from "zod";
import { disposalRouteSchema } from "@/lib/validation/environmental";

export const MATERIAL_KINDS = ["contaminated_soil", "asbestos", "invasive_species", "other_hazardous", "biological", "other"] as const;
export const MATERIAL_KIND_LABELS: Record<(typeof MATERIAL_KINDS)[number], string> = {
  contaminated_soil: "Contaminated soil",
  asbestos: "Asbestos",
  invasive_species: "Invasive species (e.g. Japanese knotweed)",
  other_hazardous: "Other hazardous material",
  biological: "Biological or clinical",
  other: "Other controlled material",
};

const id = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().max(max);
const files = z.array(id).max(30);

export const classificationBody = z.object({
  name: text(200).min(1),
  materialKind: z.enum(MATERIAL_KINDS),
  description: text(2000).nullish(),
  siteId: id.nullish(),
  projectId: id.nullish(),
  ewcCode: text(20).nullish(),
  hazardous: z.boolean().default(false),
  hazardousProperties: z.array(z.string().trim().regex(/^HP\s?\d{1,2}$/i, "Use the HP1 to HP15 form.")).max(15).default([]),
  labReference: text(300).nullish(),
  classifiedBy: text(200).nullish(),
  classifiedOn: z.coerce.date().nullish(),
  plannedRoute: disposalRouteSchema.nullish(),
  estimatedTonnes: z.coerce.number().positive().max(10_000_000).nullish(),
  evidenceFileIds: files.default([]),
  notes: text(2000).nullish(),
});
export const classificationPatch = classificationBody.partial().extend({ action: z.enum(["approve", "withdraw"]).optional() });

export const movementBody = z.object({
  siteId: id,
  projectId: id.nullish(),
  facilityId: id.nullish(),
  classificationId: id,
  plannedOn: z.coerce.date(),
  plannedTonnes: z.coerce.number().positive().max(1_000_000),
  disposalRoute: disposalRouteSchema.nullish(),
  destinationName: text(200).min(1),
  destinationPermit: text(100).nullish(),
  destinationAuthorisedEwc: z.array(text(20)).max(100).default([]),
  carrierName: text(200).nullish(),
  carrierRegistration: text(40).nullish(),
  carrierRegistrationExpiry: z.coerce.date().nullish(),
  vehicleRegistration: text(20).nullish(),
  noteReference: text(100).nullish(),
  haulDistanceKm: z.coerce.number().nonnegative().max(20_000).nullish(),
  returnedCopyDue: z.coerce.date().nullish(),
  evidenceFileIds: files.default([]),
  notes: text(2000).nullish(),
});

export const movementPatch = movementBody.omit({ siteId: true, classificationId: true }).partial().extend({
  action: z.enum(["update", "dispatch", "receive", "reject", "cancel"]).default("update"),
  receivedOn: z.coerce.date().nullish(),
  ticketTonnes: z.coerce.number().positive().max(1_000_000).nullish(),
  returnedCopyOn: z.coerce.date().nullish(),
  rejectionReason: text(1000).nullish(),
});
