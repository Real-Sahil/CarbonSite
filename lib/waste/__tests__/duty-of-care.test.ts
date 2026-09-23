import { describe, expect, it } from "vitest";
import { carrierTier, checkDutyOfCare, formatEwc, normaliseEwc, type WasteTransferInput } from "../duty-of-care";

const base: WasteTransferInput = {
  recordedAt: new Date("2026-03-10T00:00:00Z"),
  hazardous: false,
  ewcCode: "17 01 07",
  carrierName: "Acme Skips",
  carrierRegistration: "CBDU123456",
  transferNoteReference: "WTN-0042",
  destination: "Permit EPR/AB1234CD",
};
const onFile = [{ registration: "cbdu 123456", expiresAt: new Date("2027-01-01"), name: "Acme Skips" }];
const codes = (r: ReturnType<typeof checkDutyOfCare>) => r.issues.map((i) => i.code);

describe("EWC codes", () => {
  it("normalises the usual spellings and rejects non-codes", () => {
    expect(normaliseEwc("17 01 07")).toBe("170107");
    expect(normaliseEwc("17.06.05*")).toBe("170605*");
    expect(normaliseEwc("1701")).toBeNull();
    expect(normaliseEwc("99 01 01")).toBeNull();
    expect(formatEwc("170605*")).toBe("17 06 05*");
  });
});

describe("carrier registration", () => {
  it("reads the tier from the prefix", () => {
    expect(carrierTier("CBDU 123456")).toBe("upper");
    expect(carrierTier("CBDL99999")).toBe("lower");
    expect(carrierTier("WCR/R/1234567")).toBe("scotland");
    expect(carrierTier("ROCUT123")).toBe("northern_ireland");
    expect(carrierTier("12345")).toBe("unknown");
  });
});

describe("duty of care check", () => {
  it("passes a complete transfer by a registered carrier on file", () => {
    const r = checkDutyOfCare(base, onFile);
    expect(r.issues).toEqual([]);
    expect(r.complete).toBe(true);
    expect(r.keepUntil.toISOString().slice(0, 10)).toBe("2028-03-10");
  });

  it("keeps hazardous consignment notes for three years", () => {
    const r = checkDutyOfCare({ ...base, hazardous: true, ewcCode: "17 06 05*" }, onFile);
    expect(r.keepUntil.toISOString().slice(0, 10)).toBe("2029-03-10");
  });

  it("flags an asterisked code not marked hazardous", () => {
    expect(codes(checkDutyOfCare({ ...base, ewcCode: "170605*" }, onFile))).toContain("ewc_hazardous_mismatch");
  });

  it("fails a transfer with no registration, note or code", () => {
    const r = checkDutyOfCare({ ...base, ewcCode: null, carrierRegistration: null, transferNoteReference: null }, onFile);
    expect(r.complete).toBe(false);
    expect(codes(r)).toEqual(expect.arrayContaining(["ewc_missing", "registration_missing", "note_missing"]));
  });

  it("fails when the carrier's registration had expired on the transfer date", () => {
    const expired = [{ ...onFile[0], expiresAt: new Date("2026-01-31") }];
    expect(codes(checkDutyOfCare(base, expired))).toContain("registration_expired");
  });

  it("warns on a lower-tier carrier and a carrier not on file", () => {
    const r = checkDutyOfCare({ ...base, carrierRegistration: "CBDL555" }, onFile);
    expect(r.complete).toBe(true);
    expect(codes(r)).toEqual(["registration_lower_tier", "registration_not_on_file"]);
  });
});
