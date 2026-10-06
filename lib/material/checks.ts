// Deterministic checks on a controlled material movement: is the evidence for
// duty of care complete? Reuses the waste duty-of-care rules (carrier tier and
// expiry, EWC code, transfer or consignment note) and adds the checks that
// belong to a classified load. Pure. The platform shows whether the evidence is
// complete; the organisation's competent person decides whether a load is
// lawful.

import { checkDutyOfCare, normaliseEwc, type DutyOfCareIssue, type KnownCarrier } from "@/lib/waste/duty-of-care";

export type MaterialIssue = DutyOfCareIssue & { fix?: { label: string; path: string } };

export type ClassificationFacts = {
  status: string;
  materialKind: string;
  ewcCode: string | null;
  hazardous: boolean;
  labReference: string | null;
  evidenceCount: number;
};

export type MovementFacts = {
  status: string;
  plannedOn: Date;
  receivedOn: Date | null;
  plannedTonnes: number;
  ticketTonnes: number | null;
  destinationName: string;
  destinationPermit: string | null;
  destinationAuthorisedEwc: string[];
  carrierName: string | null;
  carrierRegistration: string | null;
  carrierRegistrationExpiry: Date | null;
  vehicleRegistration: string | null;
  noteReference: string | null;
  returnedCopyDue: Date | null;
  returnedCopyOn: Date | null;
  evidenceCount: number;
};

/** A ticket weight further than this from the planned load is queried. */
export const WEIGHT_TOLERANCE = 0.1;

const PAGE = "material-movements";
const CLASSIFIED_NEEDS_LAB = new Set(["contaminated_soil", "asbestos", "other_hazardous", "biological"]);

export function movementChecks(m: MovementFacts, c: ClassificationFacts, profiles: KnownCarrier[], now = new Date()): { issues: MaterialIssue[]; keepUntil: Date; complete: boolean } {
  const issues: MaterialIssue[] = [];
  const add = (level: "error" | "warning", code: string, message: string, label: string) => issues.push({ level, code, message, fix: { label, path: PAGE } });

  if (m.status === "cancelled" || m.status === "rejected") return { issues, keepUntil: m.plannedOn, complete: true };

  if (c.status !== "approved") add("error", "classification_not_approved", "The material is not classified and approved. Classify it before it moves.", "Approve the classification");
  if (CLASSIFIED_NEEDS_LAB.has(c.materialKind) && !c.labReference && c.evidenceCount === 0) {
    add("warning", "classification_no_evidence", "No laboratory report reference or file behind the classification.", "Add the laboratory reference");
  }

  // The movement's own registration expiry overrides what the supplier profiles hold.
  const reg = m.carrierRegistration;
  const carriers: KnownCarrier[] = [
    ...(reg && m.carrierRegistrationExpiry ? [{ registration: reg, expiresAt: m.carrierRegistrationExpiry, name: m.carrierName }] : []),
    ...profiles,
  ];
  const duty = checkDutyOfCare(
    {
      recordedAt: m.receivedOn ?? m.plannedOn,
      hazardous: c.hazardous,
      ewcCode: c.ewcCode,
      carrierName: m.carrierName,
      carrierRegistration: m.carrierRegistration,
      transferNoteReference: m.noteReference,
      destination: m.destinationPermit ?? m.destinationName,
    },
    carriers,
  );
  for (const i of duty.issues) {
    // The destination is always named on a movement; its permit is checked below.
    if (i.code === "destination_missing") continue;
    const label = i.code.startsWith("ewc") ? "Fix the classification" : i.code.startsWith("note") ? "Add the note reference" : "Fix the carrier details";
    issues.push({ ...i, fix: { label, path: PAGE } });
  }

  if (!m.destinationPermit) add("warning", "permit_missing", "No permit or exemption number recorded for the receiving site.", "Add the permit number");
  const ewc = normaliseEwc(c.ewcCode);
  if (ewc) {
    const listed = m.destinationAuthorisedEwc.map((x) => normaliseEwc(x)).filter((x): x is string => !!x);
    if (!listed.length) add("warning", "destination_codes_not_entered", "The codes the destination is authorised to take are not entered, so coverage cannot be checked.", "Enter the permit's codes");
    else if (!listed.includes(ewc)) add("error", "destination_ewc_not_covered", `The destination's entered permit codes do not include ${c.ewcCode}.`, "Check the destination");
  }

  if (m.ticketTonnes != null && m.plannedTonnes > 0 && Math.abs(m.ticketTonnes - m.plannedTonnes) / m.plannedTonnes > WEIGHT_TOLERANCE) {
    add("warning", "weight_differs", `Ticket weight ${m.ticketTonnes} t is more than ${WEIGHT_TOLERANCE * 100}% from the planned ${m.plannedTonnes} t.`, "Check the weighbridge ticket");
  }
  if (m.returnedCopyDue && !m.returnedCopyOn && m.returnedCopyDue < now && (m.status === "dispatched" || m.status === "received")) {
    add("error", "returned_copy_overdue", `The returned copy of the note was due on ${m.returnedCopyDue.toISOString().slice(0, 10)} and has not come back.`, "Chase the destination");
  }
  if (m.status === "received" && m.evidenceCount === 0) add("warning", "evidence_missing", "No ticket, note or photograph attached to this load.", "Attach the ticket or note");

  return { issues, keepUntil: duty.keepUntil, complete: !issues.some((i) => i.level === "error") };
}

/** What stops a classification being approved. Empty when it can be. */
export function classificationBlockers(c: ClassificationFacts & { classifiedBy: string | null; classifiedOn: Date | null }): string[] {
  const out: string[] = [];
  const ewc = normaliseEwc(c.ewcCode);
  if (!c.ewcCode) out.push("Enter the EWC code.");
  else if (!ewc) out.push("The EWC code is not a List of Waste code (six digits, for example 17 05 04).");
  else if (ewc.endsWith("*") && !c.hazardous) out.push("An EWC code marked * is a hazardous entry: mark the material hazardous.");
  else if (!ewc.endsWith("*") && c.hazardous) out.push("Hazardous material takes an EWC code marked *, for example 17 05 03*.");
  if (!c.classifiedBy) out.push("Name the competent person who classified it.");
  if (!c.classifiedOn) out.push("Enter the date it was classified.");
  if (CLASSIFIED_NEEDS_LAB.has(c.materialKind) && !c.labReference && c.evidenceCount === 0) out.push("Add the laboratory report reference or attach the report.");
  return out;
}
