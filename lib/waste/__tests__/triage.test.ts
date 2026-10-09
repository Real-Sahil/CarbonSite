import { describe, expect, it } from "vitest";
import { carrierDefaults, periodFor, triageDocument, type PastLoad } from "../triage";
import { changedFromSuggestion } from "../accept";

const load = (o: Partial<PastLoad> = {}): PastLoad => ({ carrierRegistration: "CBDU123456", carrierName: "Acme", ewcCode: "17 09 04", facilityId: "f1", wasteType: "Mixed C&D", disposalRoute: "recycling_mixed", hazardous: false, destination: "Yard", weightTonnes: 6, recordedAt: new Date("2026-08-01"), ...o });
const periods = [{ id: "p1", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") }];
const read = { reference: "WTN1", carrier: "Acme", carrierRegistration: "CBDU123456", ewc: "17 09 04", tonnes: 7, date: "2026-10-01", found: 5, registerCheck: { status: "registered" } };
const doc = (extracted: unknown = read) => ({ kind: "transfer_note", wasteRecordId: null, reference: null, issuer: null, projectId: null, extracted: extracted as never });

describe("carrierDefaults", () => {
  it("needs two agreeing loads to be consistent", () => {
    expect(carrierDefaults([load()], { registration: "CBDU 123456" }, "170904")?.consistent).toBe(false);
    expect(carrierDefaults([load(), load({ weightTonnes: 8 })], { registration: "cbdu123456" }, "17 09 04")?.consistent).toBe(true);
    expect(carrierDefaults([load(), load({ disposalRoute: "landfill_mixed" })], { registration: "CBDU123456" }, "17 09 04")?.consistent).toBe(false);
  });
  it("never mixes carriers or waste codes", () => {
    expect(carrierDefaults([load({ carrierRegistration: "CBDU999999" })], { registration: "CBDU123456" }, "17 09 04")).toBeNull();
    expect(carrierDefaults([load()], { registration: "CBDU123456" }, "20 03 01")).toBeNull();
  });
});

describe("triageDocument", () => {
  const defaults = carrierDefaults([load(), load()], { registration: "CBDU123456" }, "17 09 04");
  const base = { defaults, periodId: periodFor(periods, "2026-10-01"), duplicateReference: false };
  it("is ready when everything lines up", () => {
    const t = triageDocument({ doc: doc(), ...base });
    expect(t.reasons).toEqual([]);
    expect(t.state).toBe("ready");
    expect(t.body?.facilityId).toBe("f1");
  });
  it.each([
    ["unregistered carrier", { ...read, registerCheck: { status: "not_found" } }, "not on the Environment Agency"],
    ["expired registration", { ...read, registerCheck: { status: "expired" } }, "expired"],
    ["register unchecked", { ...read, registerCheck: undefined }, "not checked"],
    ["no weight", { ...read, tonnes: undefined }, "No weight"],
    ["much heavier", { ...read, tonnes: 40 }, "heavier"],
  ])("needs a look: %s", (_n, r, text) => {
    const t = triageDocument({ doc: doc(r), ...base });
    expect(t.state).toBe("review");
    expect(t.reasons.join(" ")).toContain(text);
  });
  it("needs a look for a repeat reference, an unknown carrier, a date outside every period, or an unread file", () => {
    expect(triageDocument({ doc: doc(), ...base, duplicateReference: true }).state).toBe("review");
    expect(triageDocument({ doc: doc(), ...base, defaults: null }).body).toBeNull();
    expect(triageDocument({ doc: doc(), ...base, periodId: periodFor(periods, "2027-02-01") }).state).toBe("review");
    expect(triageDocument({ doc: doc(null), ...base }).state).toBe("unread");
  });
});

describe("changedFromSuggestion", () => {
  it("counts only fields the suggestion had and the reviewer changed", () => {
    const final = { facilityId: "f2", reportingPeriodId: "p1", wasteType: "x", disposalRoute: "recycling_mixed", hazardous: false, weightTonnes: 7, recordedAt: "2026-10-01", allowDuplicate: false } as never;
    expect(changedFromSuggestion({ facilityId: "f1", reportingPeriodId: "p1", weightTonnes: 7 }, final)).toBe(1);
    expect(changedFromSuggestion({}, final)).toBe(0);
  });
});
