import { describe, expect, it } from "vitest";
import { classificationBlockers, movementChecks, type ClassificationFacts, type MovementFacts } from "../checks";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const cls: ClassificationFacts = { status: "approved", materialKind: "contaminated_soil", ewcCode: "17 05 03*", hazardous: true, labReference: "LAB-1", evidenceCount: 1 };
const mv: MovementFacts = {
  status: "dispatched", plannedOn: d("2026-09-10"), receivedOn: null, plannedTonnes: 20, ticketTonnes: null,
  destinationName: "Eastside Treatment", destinationPermit: "EPR/AB1234CD", destinationAuthorisedEwc: ["17 05 03*"],
  carrierName: "Haul Ltd", carrierRegistration: "CBDU123456", carrierRegistrationExpiry: d("2027-01-01"),
  vehicleRegistration: "AB12CDE", noteReference: "CN-001", returnedCopyDue: null, returnedCopyOn: null, evidenceCount: 1,
};
const codes = (m: Partial<MovementFacts> = {}, c: Partial<ClassificationFacts> = {}, now?: Date) =>
  movementChecks({ ...mv, ...m }, { ...cls, ...c }, [], now).issues.map((i) => i.code);

describe("movementChecks", () => {
  it("a complete hazardous load has no errors", () => {
    const r = movementChecks(mv, cls, []);
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(r.complete).toBe(true);
    expect(r.keepUntil.toISOString().slice(0, 10)).toBe("2029-09-10"); // three years for hazardous
  });
  it("blocks on an unapproved classification", () => {
    expect(codes({}, { status: "draft" })).toContain("classification_not_approved");
  });
  it("hazardous load without a consignment note reference", () => {
    expect(codes({ noteReference: null })).toContain("note_missing");
  });
  it("carrier registration expiry from the movement beats the profiles", () => {
    expect(codes({ carrierRegistrationExpiry: d("2026-01-01") })).toContain("registration_expired");
  });
  it("destination permit codes must include the load's code, or say they are not entered", () => {
    expect(codes({ destinationAuthorisedEwc: ["20 03 01"] })).toContain("destination_ewc_not_covered");
    expect(codes({ destinationAuthorisedEwc: [] })).toContain("destination_codes_not_entered");
    expect(codes({ destinationAuthorisedEwc: ["170503*"] })).not.toContain("destination_ewc_not_covered");
  });
  it("queries a ticket weight more than 10% off the plan", () => {
    expect(codes({ ticketTonnes: 25 })).toContain("weight_differs");
    expect(codes({ ticketTonnes: 21 })).not.toContain("weight_differs");
  });
  it("overdue returned copy is an error only while open", () => {
    expect(codes({ returnedCopyDue: d("2026-09-20") }, {}, d("2026-10-01"))).toContain("returned_copy_overdue");
    expect(codes({ returnedCopyDue: d("2026-09-20"), returnedCopyOn: d("2026-09-25") }, {}, d("2026-10-01"))).not.toContain("returned_copy_overdue");
    expect(codes({ returnedCopyDue: d("2026-10-20") }, {}, d("2026-10-01"))).not.toContain("returned_copy_overdue");
  });
  it("received load with nothing attached is queried; cancelled loads are left alone", () => {
    expect(codes({ status: "received", evidenceCount: 0 })).toContain("evidence_missing");
    expect(codes({ status: "cancelled", noteReference: null })).toEqual([]);
  });
  it("every issue says where to fix it", () => {
    for (const i of movementChecks({ ...mv, noteReference: null, destinationPermit: null }, { ...cls, status: "draft" }, []).issues) expect(i.fix?.path).toBe("material-movements");
  });
});

describe("classificationBlockers", () => {
  const ok = { ...cls, classifiedBy: "J Smith", classifiedOn: d("2026-09-01") };
  it("passes a complete classification", () => expect(classificationBlockers(ok)).toEqual([]));
  it("asterisk and hazardous flag must agree", () => {
    expect(classificationBlockers({ ...ok, hazardous: false })).toHaveLength(1);
    expect(classificationBlockers({ ...ok, ewcCode: "17 05 04" })).toHaveLength(1);
    expect(classificationBlockers({ ...ok, hazardous: false, ewcCode: "17 05 04" })).toEqual([]);
  });
  it("needs the person, the date and lab evidence for contaminated soil", () => {
    expect(classificationBlockers({ ...ok, classifiedBy: null, classifiedOn: null, labReference: null, evidenceCount: 0 })).toHaveLength(3);
  });
  it("rejects a code that is not on the List of Waste", () => {
    expect(classificationBlockers({ ...ok, ewcCode: "99 99 99" })[0]).toMatch(/List of Waste/);
  });
});
