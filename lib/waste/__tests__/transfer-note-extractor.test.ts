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

describe("real-world layouts", () => {
  it("reads thousands as thousands: 4,560 kg is 4.56 t, not 0.005", () => {
    expect(extractTransferNote("Net weight: 4,560 kg").tonnes).toBe(4.56);
    expect(extractTransferNote("Quantity 17,430 kg").tonnes).toBe(17.43);
    expect(extractTransferNote("Net weight 3,5 tonnes").tonnes).toBe(3.5);
  });
  it("takes the net figure on a weighbridge ticket, not gross or tare", () => {
    expect(extractTransferNote("Gross : 18,960 kg\nTare : 14,400 kg\nNet : 4,560 kg").tonnes).toBe(4.56);
  });
  it("keeps a WTN token whole", () => {
    expect(extractTransferNote("Ticket No : WTN-2026-381").reference).toBe("WTN-2026-381");
    expect(extractTransferNote("Waste Transfer Note\nTransfer note number \tWTN-2026-400\nDate 09.10.26").reference).toBe("WTN-2026-400");
  });
  it("reads a value printed on the line below its label", () => {
    const r = extractTransferNote("Note number\nWTN/5120\nDate of transfer\n04/10/2026\nCarrier\nJ. Patel & Sons\nQuantity\n13.23 tonnes");
    expect(r).toMatchObject({ reference: "WTN/5120", date: "2026-10-04", carrier: "J. Patel & Sons", tonnes: 13.23 });
  });
  it("reads ISO and day-month-name dates and a unit named in the label", () => {
    expect(extractTransferNote("Collected on 2026-08-08").date).toBe("2026-08-08");
    expect(extractTransferNote("Date: 27-Feb-2026").date).toBe("2026-02-27");
    expect(extractTransferNote("Quantity (tonnes): 6.90").tonnes).toBe(6.9);
  });
  it("keeps a carrier name that contains Reg, and cuts a trailing registration", () => {
    expect(extractTransferNote("Carrier: Old Reg Haulage\nCarrier registration CBDU900001").carrier).toBe("Old Reg Haulage");
    expect(extractTransferNote("Carrier: Castle Plant & Haulage. Registration no. CBDL614757.").carrier).toBe("Castle Plant & Haulage");
  });
  it("does not guess a carrier from 'Collected by'", () => {
    expect(extractTransferNote("Collected by: Bramley Waste Ltd\nEWC 17 09 04").carrier).toBeUndefined();
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
