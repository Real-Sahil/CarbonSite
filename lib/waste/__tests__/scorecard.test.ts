import { describe, expect, it } from "vitest";
import { carrierKey, scoreCarriers } from "../scorecard";

const load = (reg: string | null, w: number, name = "Acme") => ({ carrierRegistration: reg, carrierName: name, weightTonnes: w });
const note = (o: Partial<Parameters<typeof scoreCarriers>[1][number]> = {}) => ({ carrierRegistration: "CBDU123456", carrierName: "Acme", recorded: true, changedFields: 0, registerCheck: { status: "registered", company: { status: "active" } }, ...o });

describe("carrierKey", () => {
  it("prefers the registration, normalising spacing and case", () => {
    expect(carrierKey("cbdu 123456", "Acme")).toBe("reg:CBDU123456");
    expect(carrierKey(null, "Acme Ltd")).toBe("name:ACMELTD");
    expect(carrierKey(null, "")).toBe("");
  });
});

describe("scoreCarriers", () => {
  it("counts loads, tonnes and the median weight per carrier", () => {
    const [row] = scoreCarriers([load("CBDU123456", 2), load("CBDU123456", 4), load("CBDU123456", 6)], []);
    expect(row).toMatchObject({ loads: 3, totalTonnes: 12, medianTonnes: 4, heavyLoads: 0 });
  });
  it("flags a load far heavier than the usual one", () => {
    const [row] = scoreCarriers([load("CBDU123456", 5), load("CBDU123456", 5), load("CBDU123456", 5), load("CBDU123456", 40)], []);
    expect(row.heavyLoads).toBe(1);
    expect(row.flags.map((f) => f.text)).toContain("1 load far heavier than usual");
  });
  it("reads register and company status from the newest check", () => {
    const rows = scoreCarriers([load("CBDU123456", 1)], [note({ registerCheck: { status: "expired" } }), note({ registerCheck: { status: "registered", company: { status: "dissolved" } } })]);
    expect(rows[0].register).toBe("expired");
    expect(rows[0].flags.map((f) => f.text)).toContain("Registration expired");
  });
  it("flags a dissolved company as red", () => {
    const [row] = scoreCarriers([load("CBDU123456", 1)], [note({ registerCheck: { status: "registered", company: { status: "dissolved" } } })]);
    expect(row.flags).toContainEqual({ level: "red", text: "Company is dissolved" });
  });
  it("does not judge edits until there are enough measured notes", () => {
    const two = scoreCarriers([load("CBDU123456", 1)], [note({ changedFields: 3 }), note({ changedFields: 3 })]);
    expect(two[0].flags.some((f) => f.text.includes("change most notes"))).toBe(false);
    const three = scoreCarriers([load("CBDU123456", 1)], [note({ changedFields: 3 }), note({ changedFields: 2 }), note({ changedFields: 1 })]);
    expect(three[0].avgChangedFields).toBe(2);
    expect(three[0].flags.some((f) => f.text.includes("change most notes"))).toBe(true);
  });
  it("counts notes that were never recorded", () => {
    const [row] = scoreCarriers([], [note({ recorded: true }), note({ recorded: false, changedFields: null })]);
    expect(row).toMatchObject({ notesReceived: 2, notesRecorded: 1, measuredNotes: 1 });
  });
  it("keeps carriers apart and puts the ones needing attention first", () => {
    const rows = scoreCarriers(
      [load("CBDU111111", 1, "Good"), load("CBDU222222", 1, "Bad")],
      [note({ carrierRegistration: "CBDU222222", carrierName: "Bad", registerCheck: { status: "not_found" } })],
    );
    expect(rows.map((r) => r.name)).toEqual(["Bad", "Good"]);
    expect(rows[0].flags[0]).toEqual({ level: "red", text: "Not on the Environment Agency register" });
  });
});
