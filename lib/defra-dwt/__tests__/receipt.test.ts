import { describe, expect, it } from "vitest";
import { receiptProblems, submissionDeadline } from "../receipt";

const base = () => ({
  apiCode: "1f83215e-4b90-4785-9ab2-2614839aa2e9",
  dateTimeReceived: "2026-10-05T09:30:00Z",
  wasteItems: [
    {
      ewcCodes: ["200121"], wasteDescription: "Mixed soil", physicalForm: "Solid", numberOfContainers: 1, typeOfContainers: "Skip",
      weight: { metric: "Tonnes", amount: 6.9, isEstimate: false }, containsPops: false, containsHazardous: false,
    },
  ],
  carrier: { registrationNumber: "CBDL12345", organisationName: "A Haulier", meansOfTransport: "Road" },
  receiver: { siteName: "Depot", authorisationNumber: "EPR/AB1234CD" },
  receipt: { address: { fullAddress: "1 Yard Lane", postcode: "RG1 1AA" } },
});

describe("Defra receipt check", () => {
  it("accepts a basic single-item receipt (PAT R01 shape)", () => {
    expect(receiptProblems(base())).toEqual([]);
  });

  it("asks for a reason when the carrier has no registration number (C01 and C02)", () => {
    const r = base();
    r.carrier.registrationNumber = null as never;
    expect(receiptProblems(r).join()).toContain("reasonForNoRegistrationNumber");
    (r.carrier as Record<string, unknown>).reasonForNoRegistrationNumber = "Overseas carrier";
    expect(receiptProblems(r)).toEqual([]);
  });

  it("needs a consignment code or reason for hazardous waste, and details behind the flag (H02, H03)", () => {
    const r = base();
    Object.assign(r.wasteItems[0], { containsHazardous: true });
    expect(receiptProblems(r).join()).toContain("hazardous details");
    Object.assign(r.wasteItems[0], { hazardous: { sourceOfComponents: "OWN_TESTING", hazCodes: ["HP 3"] } });
    expect(receiptProblems(r).join()).toContain("consignment");
    Object.assign(r, { reasonForNoConsignmentCode: "NO_DOC_WITH_WASTE" });
    expect(receiptProblems(r)).toEqual([]);
  });

  it("rejects an EWC code with a space or asterisk", () => {
    const r = base();
    r.wasteItems[0].ewcCodes = ["17 05 03*"];
    expect(receiptProblems(r).join()).toContain("six digits");
  });

  it("gives two working days after the day of receipt", () => {
    // Monday 5 October 2026 morning: due before midnight on Wednesday 7th.
    expect(submissionDeadline(new Date("2026-10-05T09:00:00Z")).toISOString()).toBe("2026-10-07T23:59:59.999Z");
    // Friday: weekend skipped, due Tuesday.
    expect(submissionDeadline(new Date("2026-10-09T16:00:00Z")).toISOString()).toBe("2026-10-13T23:59:59.999Z");
  });
});
