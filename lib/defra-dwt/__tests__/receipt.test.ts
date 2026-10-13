import { describe, expect, it } from "vitest";
import { receiptProblems, submissionDeadline } from "../receipt";
import { baseReceipt } from "./receipt-fixture";

const withItem = (patch: object) => {
  const r = baseReceipt();
  Object.assign(r.wasteItems[0], patch);
  return r;
};

// One hazardous item (EWC 17 05 03, not the asterisk) with a consignment code, unless a test removes it.
const hazardousReceipt = (hazCodes: string[] = ["HP_3"]) => {
  const r = withItem({
    ewcCodes: ["170503"],
    containsHazardous: true,
    hazardous: { sourceOfComponents: "OWN_TESTING", hazCodes, components: [{ name: "Lead" }] },
  });
  return Object.assign(r, { hazardousWasteConsignmentCode: "CJ32LE/A0001" });
};

describe("Defra receipt check", () => {
  it("accepts a basic single-item receipt (PAT R01 shape)", () => {
    expect(receiptProblems(baseReceipt())).toEqual([]);
  });

  it("asks for a reason when the carrier has no registration number (C01 and C02)", () => {
    const r = baseReceipt();
    r.carrier.registrationNumber = null as never;
    expect(receiptProblems(r).join()).toContain("reasonForNoRegistrationNumber");
    (r.carrier as Record<string, unknown>).reasonForNoRegistrationNumber = "ONE_OFF";
    expect(receiptProblems(r)).toEqual([]);
  });

  it("takes only the spec's reasons for a missing carrier registration number", () => {
    const r = baseReceipt();
    Object.assign(r.carrier, { registrationNumber: null, reasonForNoRegistrationNumber: "Overseas carrier" });
    expect(receiptProblems(r).join()).toContain("carrier.reasonForNoRegistrationNumber");
    Object.assign(r.carrier, { reasonForNoRegistrationNumber: "MARINE" });
    expect(receiptProblems(r)).toEqual([]);
  });

  it("needs details behind the hazardous flag, then a consignment code or reason (H02, H03)", () => {
    const flagged = withItem({ containsHazardous: true });
    expect(receiptProblems(flagged).join()).toContain("hazardous details");

    const r = hazardousReceipt();
    Object.assign(r, { hazardousWasteConsignmentCode: undefined });
    expect(receiptProblems(r).join()).toContain("consignment");
    Object.assign(r, { reasonForNoConsignmentCode: "NO_DOC_WITH_WASTE" });
    expect(receiptProblems(r)).toEqual([]);
  });

  it("checks the consignment note code format for England, Scotland and Northern Ireland", () => {
    for (const code of ["CJ32LE/A0001", "SB1234567", "DA5301234"]) {
      expect(receiptProblems(Object.assign(hazardousReceipt(), { hazardousWasteConsignmentCode: code })), code).toEqual([]);
    }
    for (const code of ["CJ32LE-A0001", "SX1234567", "CJ32LE/A00 1"]) {
      expect(receiptProblems(Object.assign(hazardousReceipt(), { hazardousWasteConsignmentCode: code })).join(), code).toContain("hazardousWasteConsignmentCode");
    }
  });

  it("takes hazardous property codes HP_1 to HP_15 only, written with an underscore", () => {
    expect(receiptProblems(hazardousReceipt(["HP_1", "HP_15"]))).toEqual([]);
    for (const code of ["HP_16", "HP 3", "hp_3"]) {
      expect(receiptProblems(hazardousReceipt([code])).join(), code).toContain("hazCodes.0");
    }
  });

  it("checks the site authorisation number against the UK formats in the spec", () => {
    const valid = [
      "EPR/DD2522BF",
      "EPR/XX9999XX/D9999",
      "P1234/56A/V1",
      "WPPC 12/34/V2",
      "PPC/A/1234567",
      "EAS/P/123456",
      "WML 07/61 LN/13/02/M/V2",
      "WML 04/38 PAC/2014/WCL001",
    ];
    for (const number of valid) {
      const r = baseReceipt();
      r.receiver.authorisationNumber = number;
      expect(receiptProblems(r), number).toEqual([]);
    }
    const r = baseReceipt();
    r.receiver.authorisationNumber = "XX123";
    expect(receiptProblems(r).join()).toContain("Site authorisation number must be in a valid UK format");
  });

  it("needs the vehicle registration for road transport, and not for other modes", () => {
    const r = baseReceipt();
    Object.assign(r.carrier, { vehicleRegistration: undefined });
    expect(receiptProblems(r).join()).toContain("carrier.vehicleRegistration");
    Object.assign(r.carrier, { vehicleRegistration: "   " });
    expect(receiptProblems(r).join()).toContain("carrier.vehicleRegistration");
    Object.assign(r.carrier, { meansOfTransport: "Rail", vehicleRegistration: undefined });
    expect(receiptProblems(r)).toEqual([]);
  });

  it("rejects an EWC code with a space or asterisk", () => {
    const r = baseReceipt();
    r.wasteItems[0].ewcCodes = ["17 05 03*"];
    expect(receiptProblems(r).join()).toContain("six digits");
  });

  it("refuses a zero weight (spec: amount must be greater than 0)", () => {
    const r = baseReceipt();
    r.wasteItems[0].weight.amount = 0;
    expect(receiptProblems(r).join()).toContain("wasteItems.0.weight.amount");
  });

  it("refuses an infinite weight, which JSON would send as null", () => {
    const r = baseReceipt();
    r.wasteItems[0].weight.amount = Infinity;
    expect(receiptProblems(r).join()).toContain("wasteItems.0.weight.amount");
  });

  it("refuses a weight above 100,000 tonnes in any unit, and accepts exactly that", () => {
    const r = baseReceipt();
    r.wasteItems[0].weight = { metric: "Tonnes", amount: 150000, isEstimate: false };
    expect(receiptProblems(r).join()).toContain("Weight is above 100,000 tonnes");
    r.wasteItems[0].weight = { metric: "Tonnes", amount: 100000, isEstimate: false };
    expect(receiptProblems(r)).toEqual([]);
    r.wasteItems[0].weight = { metric: "Grams", amount: 1e12, isEstimate: false };
    expect(receiptProblems(r).join()).toContain("Weight is above 100,000 tonnes");
  });

  it("refuses leading or trailing spaces in the raw request, which the schema would trim away", () => {
    const r = baseReceipt();
    r.receiver.authorisationNumber = " EPR/AB1234CD ";
    expect(receiptProblems(r)).toEqual(["receiver.authorisationNumber: Remove leading or trailing spaces"]);
  });

  it("treats a blank carrier registration number as none, so it needs a reason", () => {
    const r = baseReceipt();
    Object.assign(r.carrier, { registrationNumber: "   " });
    expect(receiptProblems(r).join()).toContain("carrier.reasonForNoRegistrationNumber");
    Object.assign(r.carrier, { reasonForNoRegistrationNumber: "ONE_OFF" });
    expect(receiptProblems(r).join()).not.toContain("reasonForNoRegistrationNumber");
  });

  it("takes a null concentration, but refuses zero, on hazardous and POPs components", () => {
    const h = hazardousReceipt();
    Object.assign(h.wasteItems[0], {
      hazardous: { sourceOfComponents: "OWN_TESTING", components: [{ name: "Lead", concentration: null }] },
    });
    expect(receiptProblems(h)).toEqual([]);
    Object.assign(h.wasteItems[0], {
      hazardous: { sourceOfComponents: "OWN_TESTING", components: [{ name: "Lead", concentration: 0 }] },
    });
    expect(receiptProblems(h).join()).toContain("wasteItems.0.hazardous.components.0.concentration");

    const p = withItem({
      containsPops: true,
      pops: { sourceOfComponents: "GUIDANCE", components: [{ code: "PCB", concentration: null }] },
    });
    expect(receiptProblems(p)).toEqual([]);
    Object.assign(p.wasteItems[0], {
      pops: { sourceOfComponents: "GUIDANCE", components: [{ code: "PCB", concentration: 0 }] },
    });
    expect(receiptProblems(p).join()).toContain("wasteItems.0.pops.components.0.concentration");
  });

  it("lists components only in line with the source of components", () => {
    const none = withItem({ containsPops: true, pops: { sourceOfComponents: "NOT_PROVIDED" } });
    expect(receiptProblems(none)).toEqual([]);

    const listed = withItem({ containsPops: true, pops: { sourceOfComponents: "NOT_PROVIDED", components: [{ code: "PCB" }] } });
    expect(receiptProblems(listed).join()).toContain("Components cannot be listed when the source is NOT_PROVIDED");

    const empty = withItem({ containsPops: true, pops: { sourceOfComponents: "GUIDANCE", components: [] } });
    expect(receiptProblems(empty).join()).toContain("Components are required when the source is GUIDANCE");
  });

  it("does not cap the waste description, which the spec leaves without a maximum", () => {
    expect(receiptProblems(withItem({ wasteDescription: "x".repeat(6000) }))).toEqual([]);
  });

  it("gives two working days after the day of receipt, in UK time", () => {
    // Monday 5 October 2026 morning (BST): due before midnight UK time on Wednesday 7th.
    const received = new Date("2026-10-05T09:00:00Z");
    expect(submissionDeadline({ kind: "receipt", received }, "england-and-wales").toISOString()).toBe("2026-10-07T22:59:59.999Z");
    // Friday: weekend skipped, due Tuesday.
    const friday = new Date("2026-10-09T16:00:00Z");
    expect(submissionDeadline({ kind: "receipt", received: friday }, "england-and-wales").toISOString()).toBe("2026-10-13T22:59:59.999Z");
  });
});
