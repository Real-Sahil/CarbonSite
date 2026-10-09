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
  it("accepts the register's legal name for the name on the note", () => {
    expect(triageDocument({ doc: doc({ ...read, carrier: "Acme", registerCheck: { status: "registered", holder: "ACME LIMITED" } }), ...base }).state).toBe("ready");
    expect(triageDocument({ doc: doc({ ...read, carrier: "J. Patel & Sons", registerCheck: { status: "registered", holder: "J PATEL AND SONS LIMITED" } }), ...base }).state).toBe("ready");
  });
  it.each([
    ["unregistered carrier", { ...read, registerCheck: { status: "not_found" } }, "not on the Environment Agency"],
    ["expired registration", { ...read, registerCheck: { status: "expired" } }, "expired"],
    ["register unchecked", { ...read, registerCheck: undefined }, "not checked"],
    ["register holder is another company", { ...read, registerCheck: { status: "registered", holder: "BIFFA WASTE SERVICES LIMITED" } }, "register holder is BIFFA WASTE SERVICES LIMITED, not Acme"],
    ["carrier company dissolved", { ...read, registerCheck: { status: "registered", company: { status: "dissolved" } } }, "dissolved at Companies House"],
    ["read from a photo", { ...read, method: "ocr" }, "Read from a photo"],
    ["weight read a thousand times too large", { ...read, tonnes: 7000 }, "too large"],
    ["weight read a thousand times too small", { ...read, tonnes: 0.007 }, "too small"],
    ["not a transfer note at all", { reference: "INV-1", date: "2026-10-01", tonnes: 4, found: 3 }, "Does not look like a waste transfer note"],
    ["no weight", { ...read, tonnes: undefined }, "No weight"],
    ["much heavier", { ...read, tonnes: 40 }, "heavier"],
  ])("needs a look: %s", (_n, r, text) => {
    const t = triageDocument({ doc: doc(r), ...base });
    expect(t.state).toBe("review");
    expect(t.reasons.join(" ")).toContain(text);
  });
  it("needs a look when another waiting note has the same reference", () => {
    const t = triageDocument({ doc: doc(), ...base, duplicatePending: true });
    expect(t.state).toBe("review");
    expect(t.reasons).toContain("Another note waiting here has the same reference");
  });
  it("needs a look for a date in the future", () => {
    const t = triageDocument({ doc: doc({ ...read, date: "2026-12-30" }), ...base, now: new Date("2026-10-01") });
    expect(t.reasons).toContain("The date is in the future");
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
