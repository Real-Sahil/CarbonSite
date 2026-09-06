import { z } from "zod";

export const waterMetricTypeSchema = z.enum(["withdrawal", "discharge", "consumption"]);
export const waterSourceSchema = z.enum([
  "municipal_supply",
  "groundwater",
  "surface_water",
  "rainwater_harvested",
  "recycled_reused",
  "third_party_wastewater",
  "other",
]);

export const disposalRouteSchema = z.enum([
  "landfill_mixed", "landfill_food", "landfill_wood", "landfill_plastic",
  "incineration_efw", "recycling_paper", "recycling_cardboard", "recycling_plastic",
  "recycling_glass", "recycling_metal", "recycling_mixed",
  "composting_food", "composting_garden", "anaerobic_digestion", "hazardous_landfill",
]);

export const createWaterRecordSchema = z.object({
  facilityId: z.string().cuid(),
  reportingPeriodId: z.string().cuid(),
  metricType: waterMetricTypeSchema,
  source: waterSourceSchema.default("other"),
  volumeM3: z.number().positive(),
  recordedAt: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

export const updateWaterRecordSchema = createWaterRecordSchema.partial();

export const createWasteRecordSchema = z.object({
  facilityId: z.string().cuid(),
  reportingPeriodId: z.string().cuid(),
  projectId: z.string().cuid().optional(),
  wasteType: z.string().min(1).max(100),
  disposalRoute: disposalRouteSchema,
  hazardous: z.boolean().default(false),
  weightTonnes: z.number().positive(),
  ewcCode: z.string().max(20).optional(),
  carrierName: z.string().max(200).optional(),
  recordedAt: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

export const updateWasteRecordSchema = createWasteRecordSchema.partial();

// Bulk CSV upload rows — same fields as the create schema, but every value
// arrives as a string from the spreadsheet, so numbers/booleans/dates are
// coerced rather than required to already be the right type.
export const waterRecordCsvRowSchema = z.object({
  facilityId: z.string().cuid(),
  reportingPeriodId: z.string().cuid(),
  metricType: waterMetricTypeSchema,
  source: waterSourceSchema.default("other"),
  volumeM3: z.coerce.number().positive(),
  recordedAt: z.coerce.date(),
  notes: z.string().max(1000).optional(),
});

export const wasteRecordCsvRowSchema = z.object({
  facilityId: z.string().cuid(),
  reportingPeriodId: z.string().cuid(),
  wasteType: z.string().min(1).max(100),
  disposalRoute: disposalRouteSchema,
  hazardous: z.coerce.boolean().default(false),
  weightTonnes: z.coerce.number().positive(),
  ewcCode: z.string().max(20).optional(),
  carrierName: z.string().max(200).optional(),
  recordedAt: z.coerce.date(),
  notes: z.string().max(1000).optional(),
});
