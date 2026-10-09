import { describe, expect, it } from "vitest";
import { extractTransferNote, parseDate, suggestedFill } from "../transfer-note-extractor";

const WTN = `WASTE TRANSFER NOTE
WTN No: HC-20931
Date of collection: 12/03/2026
Carrier: Haul Ltd
Carrier registration CBDU123456
Description of waste: Mixed construction and demolition waste
EWC code 17 09 04
Net weight 3.42 tonnes
Vehicle reg: AB12 CDE`;

describe("extractTransferNote", () => {
  it("reads a typical transfer note", () => {
    const r = extractTransferNote(WTN);
    expect(r).toMatchObject({ reference: "HC-20931", carrier: "Haul Ltd", carrierRegistration: "CBDU123456", ewc: "17 09 04", tonnes: 3.42, date: "2026-03-12", vehicle: "AB12CDE" });
  });
  it("converts kilograms to tonnes and keeps the hazardous star", () => {
    const r = extractTransferNote("Consignment note ref: ZX99/21\nEWC 17 05 03*\nGross 1,800 kg");
    expect(r.ewc).toBe("17 05 03*");
    expect(r.reference).toBe("ZX99/21");
  });
  it("leaves out what is not clearly there", () => {
    const r = extractTransferNote("Dear customer, thanks for your order.");
    expect(r.found).toBe(0);
  });
  it("rejects a chapter that is not on the list of waste", () => {
    expect(extractTransferNote("EWC 99 99 99").ewc).toBeUndefined();
  });
  it("reads a permit and an expiry", () => {
    const r = extractTransferNote("Environmental permit EPR/AB1234CD\nExpiry date: 31 Dec 2027");
    expect(r.permit).toBe("EPR/AB1234CD");
    expect(r.expiry).toBe("2027-12-31");
  });
});

describe("parseDate", () => {
  it("is day first", () => expect(parseDate("03/04/2026")).toBe("2026-04-03"));
  it("refuses nonsense", () => expect(parseDate("45/13/2026")).toBeNull());
});

describe("suggestedFill", () => {
  const r = extractTransferNote(WTN);
  it("fills blanks by kind and never overwrites", () => {
    expect(suggestedFill("transfer_note", { reference: null, issuer: null, validUntil: null }, r)).toEqual({ reference: "HC-20931", issuer: "Haul Ltd" });
    expect(suggestedFill("transfer_note", { reference: "MINE", issuer: "Mine", validUntil: null }, r)).toEqual({});
    expect(suggestedFill("carrier_licence", { reference: null, issuer: null, validUntil: null }, r).reference).toBe("CBDU123456");
  });
});
