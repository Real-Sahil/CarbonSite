// Request shape for Defra's Digital Waste Tracking "Receipt of Waste" API (v1), written from the published
// OpenAPI file in github.com/DEFRA/waste-tracking-service (docs/apiSpecifications/ReceiptAPI.yml, Open Government
// Licence v3.0). Nothing here calls the service: it checks a receipt before a person sends it, so a gap shows in
// MetricOra instead of as a 400 from Defra. Re-read the spec when Defra changes it; the API has its own validation.

import { z } from "zod";

const text = z.string().trim().min(1);
const weight = z.object({ metric: z.enum(["Grams", "Kilograms", "Tonnes"]), amount: z.number().min(0), isEstimate: z.boolean() });
const component = z.enum(["NOT_PROVIDED", "PROVIDED_WITH_WASTE", "GUIDANCE", "OWN_TESTING"]);
const address = z.object({ fullAddress: z.string().optional(), postcode: text });

const wasteItem = z
  .object({
    ewcCodes: z.array(z.string().regex(/^\d{6}$/, "An EWC code is six digits, with no spaces or asterisk")).min(1).max(5),
    wasteDescription: text.max(5000),
    physicalForm: z.enum(["Gas", "Liquid", "Solid", "Powder", "Sludge", "Mixed"]),
    numberOfContainers: z.number().int().min(0),
    typeOfContainers: text,
    weight,
    containsPops: z.boolean(),
    pops: z
      .object({
        sourceOfComponents: component,
        components: z.array(z.object({ code: text, concentration: z.number().min(0).optional(), concentrationOperator: z.enum(["<", ">"]).optional() })).optional(),
      })
      .optional(),
    containsHazardous: z.boolean(),
    hazardous: z
      .object({
        sourceOfComponents: component,
        hazCodes: z.array(z.string()).optional(),
        components: z.array(z.object({ name: text, concentration: z.number().min(0).optional(), concentrationOperator: z.literal(">").optional() })).optional(),
      })
      .optional(),
    disposalOrRecoveryCodes: z.array(z.object({ code: text, weight })).optional(),
  })
  // A flag set to true with nothing behind it is what Defra's own tests reject, so say so here first.
  .refine((w) => !w.containsPops || !!w.pops, { message: "This item contains POPs but no POPs details are given", path: ["pops"] })
  .refine((w) => !w.containsHazardous || !!w.hazardous, { message: "This item is hazardous but no hazardous details are given", path: ["hazardous"] });

export const receiptSchema = z
  .object({
    apiCode: z.string().uuid(),
    dateTimeReceived: z.string().datetime({ offset: true }),
    hazardousWasteConsignmentCode: z.string().optional(),
    reasonForNoConsignmentCode: z.enum(["NON_HAZ_WASTE_TRANSFER", "NO_DOC_WITH_WASTE", "HWRC_RECEIPT"]).optional(),
    yourUniqueReference: z.string().optional(),
    otherReferencesForMovement: z.array(z.object({ label: text, reference: text })).optional(),
    specialHandlingRequirements: z.string().max(5000).optional(),
    wasteItems: z.array(wasteItem).min(1),
    carrier: z.object({
      // Mandatory but may be null: with no number, the reason says why.
      registrationNumber: z.string().nullable(),
      reasonForNoRegistrationNumber: z.string().optional(),
      organisationName: text,
      address: address.optional(),
      emailAddress: z.string().email().optional(),
      phoneNumber: z.string().optional(),
      vehicleRegistration: z.string().max(10).optional(),
      meansOfTransport: z.enum(["Road", "Rail", "Air", "Sea", "Inland Waterway", "Piped", "Other"]),
    }),
    brokerOrDealer: z
      .object({ organisationName: text, address: address.optional(), emailAddress: z.string().email().optional(), phoneNumber: z.string().optional(), registrationNumber: z.string().optional() })
      .optional(),
    receiver: z.object({
      siteName: text,
      emailAddress: z.string().optional(),
      phoneNumber: z.string().optional(),
      authorisationNumber: text,
      regulatoryPositionStatements: z.array(z.number().int().min(1)).optional(),
    }),
    receipt: z.object({ address: z.object({ fullAddress: text, postcode: text }) }),
  })
  .superRefine((r, ctx) => {
    if (!r.carrier.registrationNumber && !r.carrier.reasonForNoRegistrationNumber) {
      ctx.addIssue({ code: "custom", path: ["carrier", "reasonForNoRegistrationNumber"], message: "A carrier with no registration number needs a reason" });
    }
    const hazardous = r.wasteItems.some((w) => w.containsHazardous);
    if (hazardous && !r.hazardousWasteConsignmentCode && !r.reasonForNoConsignmentCode) {
      ctx.addIssue({ code: "custom", path: ["reasonForNoConsignmentCode"], message: "Hazardous waste needs a consignment note code or a reason for none" });
    }
  });

export type Receipt = z.infer<typeof receiptSchema>;

/** Plain-language list of what stops a receipt being sent, for the review screen. */
export function receiptProblems(input: unknown): string[] {
  const parsed = receiptSchema.safeParse(input);
  return parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".") || "receipt"}: ${i.message}`);
}

/**
 * Defra expects a receipt before midnight on the second working day after the day of receipt (FAQ, "Timing for
 * submission"). Weekends are skipped; bank holidays are not, so this can be a day early, never late.
 */
export function submissionDeadline(received: Date): Date {
  const d = new Date(Date.UTC(received.getUTCFullYear(), received.getUTCMonth(), received.getUTCDate()));
  for (let left = 2; left > 0; ) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left--;
  }
  d.setUTCDate(d.getUTCDate() + 1); // end of that day
  return new Date(d.getTime() - 1);
}
