import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SocialValueApprovalError } from "@/lib/social-value/field-capture";

// Fuel entries from the field app: a delivery into a bowser or tank, an issue
// from it to a machine, or a dip (the level measured). Approval creates the
// fuel entry, never an ActivityRecord: receipts and bills stay the inventory.

type TxClient = Prisma.TransactionClient;

export const FUEL_ACTIONS = ["delivery", "issue", "dip"] as const;
export type FuelAction = (typeof FUEL_ACTIONS)[number];

export type FuelLogEntry = {
  action: FuelAction;
  storeId: string;
  on: string;
  litres: number;
  fuelType: string | null;
  supplierName: string | null;
  reference: string | null;
  plantAssetId: string | null;
  vehicleLabel: string | null;
  meterReading: number | null;
  note: string | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);

export function fuelLogEntry(formData: Record<string, unknown>): { entry: FuelLogEntry } | { error: string } {
  const action = formData.action;
  if (!FUEL_ACTIONS.includes(action as FuelAction)) return { error: "Choose delivery, issue or dip." };
  const storeId = text(formData.storeId, 64);
  if (!storeId) return { error: "Choose the bowser or tank." };
  const litres = num(formData.litres);
  if (!Number.isFinite(litres) || litres > 1_000_000 || (action === "dip" ? litres < 0 : litres <= 0)) {
    return { error: action === "dip" ? "Enter the level in litres, zero or more." : "Enter the litres, above zero." };
  }
  const on = typeof formData.on === "string" && DATE.test(formData.on) ? formData.on : null;
  if (!on) return { error: "Enter the date." };
  const fuelType = text(formData.fuelType, 40);
  if (action === "delivery" && !fuelType) return { error: "Enter the fuel type delivered." };
  const plantAssetId = text(formData.plantAssetId, 64);
  const vehicleLabel = text(formData.vehicleLabel, 120);
  if (action === "issue" && !plantAssetId && !vehicleLabel) return { error: "Name the machine or vehicle that took the fuel." };
  const meter = num(formData.meterReading);
  return {
    entry: {
      action: action as FuelAction, storeId, on, litres, fuelType,
      supplierName: text(formData.supplierName, 200), reference: text(formData.reference, 100),
      plantAssetId, vehicleLabel, meterReading: Number.isFinite(meter) && meter >= 0 ? meter : null,
      note: text(formData.note, 500),
    },
  };
}

/** Submission-time check: the store is the organisation's, active and at the submission's site, and any machine is the organisation's. */
export async function fuelSubmissionError(orgId: string, siteId: string | undefined | null, formData: Record<string, unknown>): Promise<string | null> {
  const parsed = fuelLogEntry(formData);
  if ("error" in parsed) return parsed.error;
  const { entry } = parsed;
  if (!siteId) return "Choose a site for this fuel entry.";
  const store = await prisma.fuelStore.findFirst({ where: { id: entry.storeId, organizationId: orgId }, select: { siteId: true, active: true } });
  if (!store || store.siteId !== siteId) return "That fuel store is not on this site.";
  if (!store.active) return "That fuel store is retired.";
  if (entry.plantAssetId) {
    const asset = await prisma.plantAsset.findFirst({ where: { id: entry.plantAssetId, organizationId: orgId }, select: { id: true } });
    if (!asset) return "That machine was not found.";
  }
  return null;
}

export class FuelApprovalError extends SocialValueApprovalError {}

type Submission = { id: string; formData: Prisma.JsonValue; submittedByUserId: string };

/** Approving a fuel log creates the entry once; a second approval returns the first. */
export async function approveFuelInTx(tx: TxClient, opts: { orgId: string; submission: Submission; evidenceFileId?: string | null }): Promise<{ fuelEntryId: string; kind: FuelAction; storeId: string; litres: number }> {
  const parsed = fuelLogEntry((opts.submission.formData ?? {}) as Record<string, unknown>);
  if ("error" in parsed) throw new FuelApprovalError(parsed.error);
  const { entry } = parsed;
  const { orgId, submission } = opts;
  const store = await tx.fuelStore.findFirst({ where: { id: entry.storeId, organizationId: orgId }, select: { id: true } });
  if (!store) throw new FuelApprovalError("That fuel store no longer exists.");
  if (entry.plantAssetId && !(await tx.plantAsset.findFirst({ where: { id: entry.plantAssetId, organizationId: orgId }, select: { id: true } }))) {
    throw new FuelApprovalError("That machine no longer exists.");
  }
  const on = new Date(`${entry.on}T00:00:00Z`);
  const base = { organizationId: orgId, storeId: entry.storeId, litres: entry.litres, note: entry.note, fieldSubmissionId: submission.id };
  const where = { fieldSubmissionId: submission.id, organizationId: orgId };
  let id: string;
  if (entry.action === "delivery") {
    id = (await tx.fuelDelivery.findFirst({ where, select: { id: true } }))?.id ??
      (await tx.fuelDelivery.create({ data: { ...base, deliveredOn: on, fuelType: entry.fuelType!, supplierName: entry.supplierName, reference: entry.reference, evidenceFileId: opts.evidenceFileId ?? null, createdByUserId: submission.submittedByUserId } })).id;
  } else if (entry.action === "issue") {
    id = (await tx.fuelIssue.findFirst({ where, select: { id: true } }))?.id ??
      (await tx.fuelIssue.create({ data: { ...base, issuedOn: on, plantAssetId: entry.plantAssetId, vehicleLabel: entry.vehicleLabel, meterReading: entry.meterReading, issuedByUserId: submission.submittedByUserId } })).id;
  } else {
    id = (await tx.fuelDip.findFirst({ where, select: { id: true } }))?.id ??
      (await tx.fuelDip.create({ data: { ...base, dippedOn: on, createdByUserId: submission.submittedByUserId } })).id;
  }
  return { fuelEntryId: id, kind: entry.action, storeId: entry.storeId, litres: entry.litres };
}
