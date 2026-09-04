import { z } from "zod";

export const createCompletenessRequirementSchema = z.object({
  facilityId: z.string().min(1),
  emissionCategoryId: z.string().min(1),
  ownerUserId: z.string().min(1).optional(),
  required: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
});

export const updateCompletenessRequirementSchema = z.object({
  ownerUserId: z.string().min(1).nullable().optional(),
  required: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
});
