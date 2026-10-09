/**
 * Decides whether a carrier's transfer note can be approved with one click. Pure: the page and the bulk
 * approval both call it with data loaded inside the organisation. A document is "ready" only when the reader
 * found every key field, the England register shows the carrier in date, this carrier and waste code has
 * always gone the same way before, the weight is in its usual range and nothing looks like a repeat.
 * Human review stays: ready means "approve with a click", never "recorded without anyone".
 */
import type { AcceptBody } from "@/lib/waste/accept";
import type { TransferNoteReading } from "@/lib/waste/transfer-note-extractor";
import { englandRegistration } from "@/lib/waste/carrier-register";

export type PastLoad = { carrierRegistration: string | null; carrierName: string | null; ewcCode: string | null; facilityId: string; wasteType: string; disposalRoute: string; hazardous: boolean; destination: string | null; weightTonnes: number; recordedAt: Date };
export type CarrierDefaults = { facilityId: string; wasteType: string; disposalRoute: string; hazardous: boolean; destination: string | null; loads: number; consistent: boolean; weights: number[] };
export type Period = { id: string; startDate: Date; endDate: Date };

const norm = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** What this carrier did with this waste code before: the latest load's choices, and whether every earlier load agrees. */
export function carrierDefaults(past: PastLoad[], carrier: { registration?: string | null; name?: string | null }, ewc: string | null | undefined): CarrierDefaults | null {
  const reg = norm(carrier.registration);
  const name = norm(carrier.name);
  const code = norm(ewc);
  const mine = past
    .filter((p) => (reg && norm(p.carrierRegistration) === reg) || (!reg && name && norm(p.carrierName) === name))
    .filter((p) => norm(p.ewcCode) === code)
    .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
  if (mine.length === 0) return null;
  const last = mine[0];
  const consistent = mine.length >= 2 && mine.every((p) => p.facilityId === last.facilityId && p.wasteType === last.wasteType && p.disposalRoute === last.disposalRoute && p.hazardous === last.hazardous);
  return { facilityId: last.facilityId, wasteType: last.wasteType, disposalRoute: last.disposalRoute, hazardous: last.hazardous, destination: last.destination, loads: mine.length, consistent, weights: mine.map((p) => p.weightTonnes) };
}

export function periodFor(periods: Period[], iso: string | undefined): string | null {
  if (!iso) return null;
  const t = new Date(`${iso}T12:00:00Z`).getTime();
  return periods.find((p) => p.startDate.getTime() <= t && t <= p.endDate.getTime() + 86_399_000)?.id ?? null;
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export type Triage = { state: "ready" | "review" | "unread"; reasons: string[]; suggestion: Partial<AcceptBody>; body: AcceptBody | null };

export function triageDocument(input: {
  doc: { kind: string; wasteRecordId: string | null; reference: string | null; issuer: string | null; projectId: string | null; extracted: (TransferNoteReading & { registerCheck?: { status: string; company?: { status: string | null } } }) | null };
  defaults: CarrierDefaults | null;
  periodId: string | null;
  duplicateReference: boolean;
}): Triage {
  const { doc, defaults, periodId, duplicateReference } = input;
  const r = doc.extracted;
  if (!r) return { state: "unread", reasons: ["Not read yet"], suggestion: {}, body: null };
  const reference = doc.reference ?? r.reference;
  const carrierName = doc.issuer ?? r.carrier;
  const suggestion: Partial<AcceptBody> = {
    projectId: doc.projectId, reportingPeriodId: periodId ?? undefined, weightTonnes: r.tonnes, ewcCode: r.ewc, recordedAt: r.date,
    transferNoteReference: reference, carrierName, carrierRegistration: r.carrierRegistration, vehicleRegistration: r.vehicle,
    ...(defaults ? { facilityId: defaults.facilityId, wasteType: defaults.wasteType, disposalRoute: defaults.disposalRoute as AcceptBody["disposalRoute"], hazardous: defaults.hazardous, destination: defaults.destination } : {}),
  };
  const reasons: string[] = [];
  if (!reference) reasons.push("No transfer note reference found");
  if (r.tonnes === undefined) reasons.push("No weight found");
  if (!r.date) reasons.push("No date found");
  else if (!periodId) reasons.push("The date is outside every reporting period");
  if (!r.ewc) reasons.push("No EWC code found");
  if (!r.carrierRegistration) reasons.push("No carrier registration found");
  else if (englandRegistration(r.carrierRegistration)) {
    const s = r.registerCheck?.status;
    if (s === "expired") reasons.push("Carrier registration has expired on the Environment Agency register");
    else if (s === "not_found") reasons.push("Carrier registration is not on the Environment Agency register");
    else if (s !== "registered") reasons.push("Carrier registration not checked on the register yet");
    const co = r.registerCheck?.company?.status;
    if (co && co.toLowerCase() !== "active") reasons.push(`The carrier's company is ${co.replace(/-/g, " ")} at Companies House`);
  } else reasons.push("Carrier registration is not an England one, so it was not checked");
  if (!defaults) reasons.push("First time we have seen this carrier and waste code: choose facility and where it went");
  else if (!defaults.consistent) reasons.push(defaults.loads === 1 ? "Only one earlier load for this carrier and waste code" : "Earlier loads for this carrier and waste code went different ways");
  if (defaults && r.tonnes !== undefined && defaults.weights.length >= 2 && r.tonnes > 3 * median(defaults.weights)) reasons.push("Much heavier than this carrier's usual load");
  if (duplicateReference) reasons.push("A waste record with this reference already exists");

  const complete = suggestion.facilityId && suggestion.reportingPeriodId && suggestion.wasteType && suggestion.disposalRoute && r.tonnes !== undefined && r.date;
  const body = complete
    ? ({ ...suggestion, hazardous: suggestion.hazardous ?? false, allowDuplicate: false, weightTonnes: r.tonnes, recordedAt: r.date } as AcceptBody)
    : null;
  return { state: reasons.length === 0 && body ? "ready" : "review", reasons, suggestion, body };
}
