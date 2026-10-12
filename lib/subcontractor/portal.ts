/**
 * Subcontractor carbon portal: the prime-to-sub flow. A main contractor asks a
 * subcontractor for tonnes CO2e by scope. The subcontractor opens a link that
 * shows one form, with no account and no organisation membership, and returns
 * their figures with optional evidence. The prime keeps the copy and verifies it
 * as before (subcontractor-submissions routes); nothing here reads the
 * subcontractor's own systems.
 *
 * Only the link token's SHA-256 is stored; the link is shown once.
 */
import { z } from "zod";
import type { SubcontractorSubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashToken, newToken } from "@/lib/management-systems/auditor-access";
import { looksLike } from "@/lib/evidence/submission-link";
import { isValidStorageKey, keys, sanitizeStorageFilename } from "@/lib/storage";

export const LINK_DAYS = 30;
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_TYPES: readonly string[] = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** Statuses the subcontractor may still answer. A rejected submission can be sent again. */
export const OPEN_STATUSES: readonly SubcontractorSubmissionStatus[] = ["requested", "overdue", "rejected"];

const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;
const TONNES_RE = /^\d{1,9}(\.\d{1,4})?$/;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.metricora.co.uk";

const tonnesField = z
  .string()
  .regex(TONNES_RE, "Enter tonnes CO2e as a number with up to 4 decimal places.")
  .optional();

/** The subcontractor's form. Each scope is optional; at least one must be entered. */
export const portalSubmissionSchema = z
  .object({
    submitterName: z.string().trim().min(1, "Enter your name.").max(120),
    scope1Tco2e: tonnesField,
    scope2Tco2e: tonnesField,
    scope3Tco2e: tonnesField,
    submitterNote: z.string().trim().max(1000).optional(),
  })
  .refine((v) => [v.scope1Tco2e, v.scope2Tco2e, v.scope3Tco2e].some((x) => x !== undefined), {
    message: "Enter at least one scope.",
    path: ["scope1Tco2e"],
  });

export type PortalSubmission = z.infer<typeof portalSubmissionSchema>;

/** Delivery choice when the team sends a link: email it, or copy it and send it themselves. */
export const issueLinkSchema = z.object({ delivery: z.enum(["email", "copy"]) });

/** Reads the text fields of the form. Blank fields are absent, not empty strings. */
export function portalFormFields(form: FormData) {
  const text = (key: string) => {
    const value = form.get(key);
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  };
  return {
    submitterName: text("submitterName"),
    scope1Tco2e: text("scope1Tco2e"),
    scope2Tco2e: text("scope2Tco2e"),
    scope3Tco2e: text("scope3Tco2e"),
    submitterNote: text("submitterNote"),
  };
}

/** A new link token. The caller stores the hash and shows the token once. */
export function issueLinkToken(now = new Date()) {
  const token = newToken();
  return {
    token,
    tokenHash: hashToken(token),
    tokenExpiresAt: new Date(now.getTime() + LINK_DAYS * 24 * 60 * 60 * 1000),
  };
}

export function portalUrl(token: string) {
  return `${APP_URL}/subcontractor/${token}`;
}

/** The open submission a link token opens, or null when it is malformed, unknown or expired. */
export async function resolveSubcontractorToken(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const row = await prisma.subcontractorCarbonSubmission.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: { select: { name: true } } },
  });
  if (!row || !row.tokenExpiresAt || row.tokenExpiresAt <= new Date()) return null;
  return row;
}

/**
 * What the subcontractor may see. Their own name, the period and the deadline, the
 * status and any rejection reason. Never the organisation's internal notes, the
 * contact email, the requester or the evidence key.
 */
export function portalView(row: {
  subcontractorName: string;
  reportingPeriodLabel: string;
  dueDate: Date;
  status: SubcontractorSubmissionStatus;
  submittedAt: Date | null;
  rejectionReason: string | null;
  tokenExpiresAt: Date | null;
}, orgName: string) {
  return {
    orgName,
    subcontractorName: row.subcontractorName,
    reportingPeriodLabel: row.reportingPeriodLabel,
    dueDate: row.dueDate.toISOString().slice(0, 10),
    status: row.status,
    canSubmit: OPEN_STATUSES.includes(row.status),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    rejectionReason: row.status === "rejected" ? row.rejectionReason : null,
    linkExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
  };
}

/**
 * A submission as the organisation's team sees it. The token hash and the evidence
 * key stay on the server; the UI gets `hasEvidence` and downloads through the
 * evidence route, which signs a one-hour URL.
 */
export function orgSubmissionView<
  T extends { tokenHash: string | null; evidenceStorageKey: string | null },
>(row: T) {
  const { tokenHash: _tokenHash, evidenceStorageKey, ...rest } = row;
  return { ...rest, hasEvidence: evidenceStorageKey !== null };
}

/**
 * Records the first time the link is opened. Later opens change nothing, so the
 * prime can see when the subcontractor first looked at the request.
 */
export async function recordOpened(submissionId: string) {
  await prisma.subcontractorCarbonSubmission.updateMany({
    where: { id: submissionId, openedAt: null },
    data: { openedAt: new Date() },
  });
}

/** An evidence file read from the form: the bytes, its type and a safe display name. */
export async function readEvidence(file: File): Promise<{ buffer: Buffer; type: string; name: string } | { error: string }> {
  const name = file.name.slice(0, 200) || "evidence";
  const type = file.type.toLowerCase();
  if (!EVIDENCE_TYPES.includes(type)) return { error: `${name}: send a PDF, JPEG, PNG or WEBP.` };
  if (file.size > MAX_EVIDENCE_BYTES) return { error: `${name}: over 10 MB.` };
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksLike(type, buffer)) return { error: `${name}: the file is not a valid ${type.split("/")[1]}.` };
  return { buffer, type, name };
}

/**
 * Storage key for a subcontractor's evidence. Each upload gets a time prefix, so a
 * resubmission after rejection never overwrites the file it replaces.
 * Underscores are not in the storage segment charset, so they become hyphens.
 */
export function evidenceKeyFor(orgId: string, submissionId: string, displayName: string, now = Date.now()) {
  const safe = sanitizeStorageFilename(displayName).replace(/_/g, "-");
  const key = keys.subcontractorEvidence(orgId, submissionId, `${now.toString(36)}-${safe}`);
  if (!isValidStorageKey(key)) throw new Error(`Cannot build a storage key for ${displayName}`);
  return key;
}
