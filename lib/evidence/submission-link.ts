/**
 * Subcontractor upload links. An organisation gives a subcontractor or
 * supplier a link; they open it with no account, say who they are and upload
 * invoices, delivery notes or order PDFs. Each file is stored as the
 * organisation's evidence and lands in the same pending list as emailed bills
 * (BillInboxItem), where an editor reads it, matches it to a record and
 * attaches or dismisses it. Nothing enters the inventory without that step.
 *
 * Only the token's SHA-256 is stored; the link is shown once.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ROLE_GROUPS } from "@/lib/auth/session";
import { hashToken, newToken } from "@/lib/management-systems/auditor-access";
import { READABLE_BILL_TYPES } from "./read-bill";

export const MAX_LINK_DAYS = 180;
export const MAX_LINK_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 5;

/** Who may issue or withdraw a link: it lets an outsider put files in front of the team. */
export const LINK_ISSUERS = [...new Set([...ROLE_GROUPS.editor, ...ROLE_GROUPS.projectManagers])];

export const createLinkSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    projectId: z.string().min(1).max(60).nullish(),
    days: z.number().int().min(1).max(MAX_LINK_DAYS),
  })
  .strict();

export const uploaderSchema = z.object({
  name: z.string().trim().min(1).max(120),
  company: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).optional(),
});

export { newToken as newLinkToken };

/** The link a token opens, or null when it is unknown, expired or revoked. */
export async function resolveSubmissionToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const link = await prisma.submissionLink.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!link || link.revokedAt || link.expiresAt <= new Date()) return null;
  return link;
}

/** True when the bytes begin like the type they claim (a renamed .exe is not a PDF). */
export function looksLike(type: string, b: Buffer): boolean {
  if (type === "application/pdf") return b.subarray(0, 5).toString("latin1") === "%PDF-";
  if (type === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8;
  if (type === "image/png") return b.subarray(1, 4).toString("latin1") === "PNG";
  if (type === "image/webp") return b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
  return false;
}

export const isReadableType = (t: string) => READABLE_BILL_TYPES.has(t);
