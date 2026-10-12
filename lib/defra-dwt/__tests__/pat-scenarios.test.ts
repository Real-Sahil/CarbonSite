// Offline shape checks for the fourteen Production Approval Test (PAT) scenarios in Defra's Receipt of Waste guidance
// (DEFRA/waste-tracking-service, OGL v3.0). Each case builds the receipt its scenario's Given steps describe and checks
// it against receiptSchema and receiptProblems, so a shape gap shows here before the External Test run.
//
// This is not Defra's result. Passing here is not Pass: only POST /production-approval-tests returns Pass, and only for
// a receipt Defra has accepted. Defra publishes no sample payloads, so the values below are ours, chosen to meet each
// Given. R06 was withdrawn and has no case. C01 and H02 are refusals, so their rejection message is pinned exactly.
import { describe, expect, it } from "vitest";
import { receiptProblems, receiptSchema } from "../receipt";
import { baseReceipt } from "./receipt-fixture";

const tonnes = (amount: number) => ({ metric: "Tonnes", amount, isEstimate: false });
const CONSIGNMENT = "CJ32LE/A0001";

const itemWith = (patch: Record<string, unknown>) => ({ ...baseReceipt().wasteItems[0], ...patch });

const receiptWith = (wasteItems: Record<string, unknown>[], carrierPatch: Record<string, unknown> = {}) => ({
  ...baseReceipt(),
  wasteItems,
  carrier: { ...baseReceipt().carrier, ...carrierPatch },
});

const hazardousItem = (hazCodes: string[], components: Record<string, unknown>[]) =>
  itemWith({ ewcCodes: ["170503"], containsHazardous: true, hazardous: { sourceOfComponents: "OWN_TESTING", hazCodes, components } });

// Accepted means the schema parses the receipt and receiptProblems lists nothing for it.
function expectAccepted(receipt: unknown) {
  expect(receiptSchema.safeParse(receipt).success).toBe(true);
  expect(receiptProblems(receipt)).toEqual([]);
}

describe("PAT scenario shapes (offline, not Defra's Pass)", () => {
  it("R01: a basic receipt with a single waste item and a Disposal or Recovery code", () => {
    expectAccepted(baseReceipt());
  });

  it("R02: a basic receipt with multiple waste items", () => {
    const second = itemWith({
      ewcCodes: ["200301"],
      wasteDescription: "Mixed municipal waste from a site office",
      numberOfContainers: 1,
      weight: tonnes(2.1),
      disposalOrRecoveryCodes: [{ code: "D10", weight: tonnes(2.1) }],
    });
    expectAccepted(receiptWith([itemWith({}), second]));
  });

  it("R03: means of transport Road, with the vehicle registration", () => {
    expectAccepted(receiptWith([itemWith({})], { meansOfTransport: "Road", vehicleRegistration: "AB12 CDE" }));
  });

  it("R04: no Disposal or Recovery codes, whether the key is absent or an empty list", () => {
    expectAccepted(receiptWith([itemWith({ disposalOrRecoveryCodes: undefined })]));
    expectAccepted(receiptWith([itemWith({ disposalOrRecoveryCodes: [] })]));
  });

  it("R05: a single item with several Disposal or Recovery codes", () => {
    const codes = [
      { code: "R1", weight: tonnes(4) },
      { code: "R3", weight: tonnes(2.9) },
    ];
    expectAccepted(receiptWith([itemWith({ disposalOrRecoveryCodes: codes })]));
  });

  it("R07: a single item with two EWC codes", () => {
    expectAccepted(receiptWith([itemWith({ ewcCodes: ["200301", "200307"] })]));
  });

  it("C01: no carrier registration number and no reason is refused, with the exact message", () => {
    const receipt = receiptWith([itemWith({})], { registrationNumber: null });
    expect(receiptProblems(receipt)).toEqual([
      "carrier.reasonForNoRegistrationNumber: A carrier with no registration number needs a reason",
    ]);
  });

  it("C02: no carrier registration number with a reason is accepted", () => {
    expectAccepted(receiptWith([itemWith({})], { registrationNumber: null, reasonForNoRegistrationNumber: "ONE_OFF" }));
  });

  it("B01: a broker or dealer is recorded with the receipt", () => {
    expectAccepted({
      ...baseReceipt(),
      brokerOrDealer: {
        organisationName: "Dealer Waste Ltd",
        registrationNumber: "CBDL54321",
        address: { fullAddress: "2 Dealer Road", postcode: "RG2 2BB" },
      },
    });
  });

  it("P01: several POPs components, one with a concentration operator", () => {
    expectAccepted(
      receiptWith([
        itemWith({
          containsPops: true,
          pops: {
            sourceOfComponents: "GUIDANCE",
            components: [
              { code: "PFHXS", concentration: 0.5, concentrationOperator: "<" },
              { code: "PFOA", concentration: 2 },
            ],
          },
        }),
      ]),
    );
  });

  it("H01: several hazardous components and property codes, with a consignment code", () => {
    expectAccepted({
      ...receiptWith([
        hazardousItem(["HP_5", "HP_10"], [
          { name: "Lead", concentration: 2.1, concentrationOperator: ">" },
          { name: "Chromium", concentration: 40, concentrationOperator: ">" },
        ]),
      ]),
      hazardousWasteConsignmentCode: CONSIGNMENT,
    });
  });

  it("H02: hazardous with no consignment code and no reason is refused, with the exact message", () => {
    // The guide sets hazardousWasteConsignmentCode to null. The spec types it as a string, so the key is left out.
    const receipt = receiptWith([hazardousItem(["HP_3"], [{ name: "Lead" }])]);
    expect(receiptProblems(receipt)).toEqual([
      "reasonForNoConsignmentCode: Hazardous waste needs a consignment note code or a reason for none",
    ]);
  });

  it("H03: hazardous with no consignment code and a reason is accepted", () => {
    expectAccepted({
      ...receiptWith([hazardousItem(["HP_3"], [{ name: "Lead" }])]),
      reasonForNoConsignmentCode: "NO_DOC_WITH_WASTE",
    });
  });

  it("X01: one item that is both hazardous and POPs, with details and a consignment code", () => {
    const item = itemWith({
      ewcCodes: ["170503"],
      containsHazardous: true,
      hazardous: {
        sourceOfComponents: "OWN_TESTING",
        hazCodes: ["HP_5"],
        components: [{ name: "Lead", concentration: 2.1, concentrationOperator: ">" }],
      },
      containsPops: true,
      pops: { sourceOfComponents: "GUIDANCE", components: [{ code: "PFOA", concentration: 2 }] },
    });
    expectAccepted({ ...receiptWith([item]), hazardousWasteConsignmentCode: CONSIGNMENT });
  });
});
