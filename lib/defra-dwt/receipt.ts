// Request shape for Defra's Digital Waste Tracking "Receipt of Waste" API (v1), written from the published
// OpenAPI file in github.com/DEFRA/waste-tracking-service (docs/apiSpecifications/ReceiptAPI.yml, Open Government
// Licence v3.0). Nothing here calls the service: it checks a receipt before a person sends it, so a gap shows in
// MetricOra instead of as a 400 from Defra. Re-read the spec when Defra changes it; the API has its own validation.

import { z } from "zod";

const text = z.string().trim().min(1);
// The spec says amount must be greater than 0, so zero is refused here as well.
const weight = z.object({ metric: z.enum(["Grams", "Kilograms", "Tonnes"]), amount: z.number().gt(0), isEstimate: z.boolean() });
const component = z.enum(["NOT_PROVIDED", "PROVIDED_WITH_WASTE", "GUIDANCE", "OWN_TESTING"]);
const address = z.object({ fullAddress: z.string().optional(), postcode: text });
// A concentration is nullable, and when it is a number it must be above 0 (spec wording).
const concentration = z.number().gt(0).nullable().optional();

// Site authorisation (permit) numbers, the shapes the spec lists for each UK nation. Matched case-insensitively.
// Defra's validator is the authority: these are the published shapes, so a valid permit is never refused here.
const AUTHORISATION_FORMATS = [
  /^(EA)?WML\d{5,6}$/i, // England: WML99999, EAWML999999
  /^(EPR\/)?[A-Z]{2}\d{4}[A-Z]{2}(\/D\d{4,5}S?)?$/i, // England and Wales: EPR/XX9999XX, with a mobile deployment suffix
  /^(PPC|WML)\/[AWNEL]\/(SEPA\d{4}-\d{4}|\d{7}(\/\d{2})?)$/i, // Scotland: PPC/A/9999999, WML/L/9999999/99
  /^EAS\/P\/\d{6}$/i, // Scotland: EAS/P/999999
  /^P\d{4}\/\d{2}[A-Z](\/V\d+)?$/i, // Northern Ireland: P9999/99X, P9999/99X/V#
  /^WPPC \d{2}\/\d{2}(\/V\d+)?$/i, // Northern Ireland: WPPC 99/99, WPPC 99/99/V#
  /^(WML \d+\/\d+(\/T)?( (LN\/\d+\/\d+(\/[MVTCN]\d*)*|PAC\/\d{4}\/WCL\d{3}))?|LN\/\d+\/\d+(\/[MVTCN]\d*)*|PAC\/\d{4}\/WCL\d{3})$/i, // WML 99/#, LN/99/#, PAC/9999/WCL999 and their combinations
];

type Components = { concentration?: number | null; concentrationOperator?: string }[] | undefined;

// Spec: NOT_PROVIDED takes no components; GUIDANCE and OWN_TESTING need at least one; an operator needs a concentration.
function checkComponents(ctx: z.RefinementCtx, field: "pops" | "hazardous", source: z.infer<typeof component>, components: Components) {
  const count = components?.length ?? 0;
  if (source === "NOT_PROVIDED" && count > 0) {
    ctx.addIssue({ code: "custom", path: [field, "components"], message: "Components cannot be listed when the source is NOT_PROVIDED" });
  }
  if ((source === "GUIDANCE" || source === "OWN_TESTING") && count === 0) {
    ctx.addIssue({ code: "custom", path: [field, "components"], message: `Components are required when the source is ${source}` });
  }
  components?.forEach((c, i) => {
    if (c.concentrationOperator && c.concentration == null) {
      ctx.addIssue({ code: "custom", path: [field, "components", i, "concentration"], message: "A concentration operator needs a concentration value" });
    }
  });
}

const wasteItem = z
  .object({
    ewcCodes: z.array(z.string().regex(/^\d{6}$/, "An EWC code is six digits, with no spaces or asterisk")).min(1).max(5),
    wasteDescription: text,
    physicalForm: z.enum(["Gas", "Liquid", "Solid", "Powder", "Sludge", "Mixed"]),
    numberOfContainers: z.number().int().min(0),
    typeOfContainers: text,
    weight,
    containsPops: z.boolean(),
    pops: z
      .object({
        sourceOfComponents: component,
        components: z.array(z.object({ code: text, concentration, concentrationOperator: z.enum(["<", ">"]).optional() })).optional(),
      })
      .optional(),
    containsHazardous: z.boolean(),
    hazardous: z
      .object({
        sourceOfComponents: component,
        hazCodes: z.array(z.string().regex(/^HP_(?:[1-9]|1[0-5])$/, "A hazardous property code is HP_1 to HP_15, with an underscore")).optional(),
        components: z.array(z.object({ name: text, concentration, concentrationOperator: z.literal(">").optional() })).optional(),
      })
      .optional(),
    disposalOrRecoveryCodes: z.array(z.object({ code: text, weight })).optional(),
  })
  // A flag set to true with nothing behind it is what Defra's own tests reject, so say so here first.
  .refine((w) => !w.containsPops || !!w.pops, { message: "This item contains POPs but no POPs details are given", path: ["pops"] })
  .refine((w) => !w.containsHazardous || !!w.hazardous, { message: "This item is hazardous but no hazardous details are given", path: ["hazardous"] })
  .superRefine((w, ctx) => {
    if (w.pops) checkComponents(ctx, "pops", w.pops.sourceOfComponents, w.pops.components);
    if (w.hazardous) checkComponents(ctx, "hazardous", w.hazardous.sourceOfComponents, w.hazardous.components);
  });

export const receiptSchema = z
  .object({
    apiCode: z.string().uuid(),
    dateTimeReceived: z.string().datetime({ offset: true }),
    // Spec: England and Wales XXXXXX/YYYYY (alphanumeric, no spaces or symbols); Scotland SA, SB or SC and seven digits; NI and Eire DA, DB or DC and seven digits.
    hazardousWasteConsignmentCode: z
      .string()
      .regex(/^(?:[A-Z0-9]{6}\/[A-Z0-9]{5}|[SD][ABC]\d{7})$/i, "Consignment note code must look like CJ32LE/A0001, SB1234567 or DA5301234")
      .optional(),
    reasonForNoConsignmentCode: z.enum(["NON_HAZ_WASTE_TRANSFER", "NO_DOC_WITH_WASTE", "HWRC_RECEIPT"]).optional(),
    yourUniqueReference: z.string().optional(),
    otherReferencesForMovement: z.array(z.object({ label: text, reference: text })).optional(),
    specialHandlingRequirements: z.string().max(5000).optional(),
    wasteItems: z.array(wasteItem).min(1),
    carrier: z.object({
      // Mandatory but may be null: with no number, the reason says why.
      registrationNumber: z.string().nullable(),
      reasonForNoRegistrationNumber: z.enum(["ON_SITE", "HOUSEHOLD", "ONE_OFF", "MARINE"]).optional(),
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
      authorisationNumber: text.refine((v) => AUTHORISATION_FORMATS.some((f) => f.test(v)), {
        message: "Site authorisation number must be in a valid UK format",
      }),
      regulatoryPositionStatements: z.array(z.number().int().min(1)).optional(),
    }),
    receipt: z.object({ address: z.object({ fullAddress: text, postcode: text }) }),
  })
  .superRefine((r, ctx) => {
    if (!r.carrier.registrationNumber && !r.carrier.reasonForNoRegistrationNumber) {
      ctx.addIssue({ code: "custom", path: ["carrier", "reasonForNoRegistrationNumber"], message: "A carrier with no registration number needs a reason" });
    }
    if (r.carrier.meansOfTransport === "Road" && !r.carrier.vehicleRegistration?.trim()) {
      ctx.addIssue({ code: "custom", path: ["carrier", "vehicleRegistration"], message: "A road movement needs the vehicle registration" });
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
