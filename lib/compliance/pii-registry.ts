// Single source of truth for which Prisma models hold personal data, and
// what happens to each on a DSAR export (Art. 15 GDPR) or erasure (Art. 17)
// request. workers/dsar-export.ts and workers/dsar-erasure.ts both iterate
// this list rather than hardcoding a table sweep — see lib/db/__tests__/
// pii-registry.test.ts for the completeness check that keeps it honest as
// the schema grows.
//
// Erasure design note: most tables here reference the subject only via a
// required (non-nullable) *UserId foreign key to User. Rather than trying
// to null a NOT NULL column, erasure "anonymize"s a person by tombstoning
// their User row (lib/db/__tests__ aside — see workers/dsar-erasure.ts,
// handled as a special case outside this registry, not a generic entry).
// Once User.email/name are scrubbed, every table that merely references
// createdByUserId/uploadedByUserId/etc. is already unlinkable to a real
// identity — no row-level change needed there. That's why most entries
// below are "retain": the identity link is severed upstream, and the
// underlying business record (an emissions calculation, an evidence file)
// stays intact for the organisation's own compliance/audit obligations.
//
// Only tables holding PII that ISN'T just a User FK — free-text content,
// or a contact address for someone who may not even be a CarbonSite user
// (a supplier contact) — need their own "redact" logic.

import type { Prisma } from "@prisma/client";

export type PiiSubject = { userId: string; email: string | null };

export type ErasureStrategy =
  | "delete" // hard-delete rows scoped to the subject
  | "redact" // update specific fields to a placeholder — see redact()
  | "retain" // no row-level action; identity link severed by tombstoning User
  | "special"; // User itself — tombstoned directly in workers/dsar-erasure.ts

export interface PiiRegistryEntry {
  /** Prisma DMMF model name, e.g. "User", "FieldSubmission". */
  model: string;
  label: string;
  erasureStrategy: ErasureStrategy;
  /** Scopes rows to one data subject — used by export for every entry, and
   *  by erasure for "delete" entries. */
  where: (subject: PiiSubject) => Record<string, unknown>;
  /** Required when erasureStrategy === "redact". Runs inside the erasure
   *  transaction; takes the transaction client so it can apply row-level
   *  conditional logic beyond a single updateMany (see SupplierDataRequest
   *  below, where only rows matching the subject's own email may be
   *  touched — a row matched via createdByUserId belongs to a different
   *  person's contact details and must not be redacted). */
  redact?: (tx: Prisma.TransactionClient, subject: PiiSubject) => Promise<void>;
}

const EMAIL_FALLBACK = "__no_match__"; // never a real email; keeps OR clauses safe when subject.email is null

export const PII_REGISTRY: PiiRegistryEntry[] = [
  {
    model: "User",
    label: "Account profile",
    erasureStrategy: "special",
    where: (s) => ({ id: s.userId }),
  },
  {
    model: "Session",
    label: "Active sign-in sessions",
    erasureStrategy: "delete",
    where: (s) => ({ userId: s.userId }),
  },
  {
    model: "SsoSession",
    label: "SSO sign-in sessions",
    erasureStrategy: "delete",
    where: (s) => ({ userId: s.userId }),
  },
  {
    model: "Account",
    label: "Sign-in credentials",
    erasureStrategy: "delete",
    where: (s) => ({ userId: s.userId }),
  },
  {
    model: "InviteLink",
    label: "Field-worker invite links",
    erasureStrategy: "delete",
    where: (s) => ({ OR: [{ email: s.email ?? EMAIL_FALLBACK }, { usedByUserId: s.userId }] }),
  },
  {
    model: "SupplierInvite",
    label: "Supplier invite links",
    erasureStrategy: "delete",
    where: (s) => ({
      OR: [
        { email: s.email ?? EMAIL_FALLBACK },
        { usedByUserId: s.userId },
        { createdByUserId: s.userId },
      ],
    }),
  },
  {
    model: "FieldWorkerAssignment",
    label: "Field-worker project assignments",
    erasureStrategy: "delete",
    where: (s) => ({ userId: s.userId }),
  },
  {
    model: "FieldWorkerSiteAssignment",
    label: "Field-worker site assignments",
    erasureStrategy: "delete",
    where: (s) => ({ userId: s.userId }),
  },
  {
    model: "ActivityRecord",
    label: "Activity records you created",
    // GPS/postcode fields on this model are near-identifying but retention
    // depth is a policy decision (see SECURITY.md / Track A2) — not
    // auto-redacted here. The creator link is severed via the User
    // tombstone; the emissions figures themselves are retained for the
    // organisation's own compliance record.
    erasureStrategy: "retain",
    where: (s) => ({ createdByUserId: s.userId }),
  },
  {
    model: "EvidenceFile",
    label: "Evidence files you uploaded",
    erasureStrategy: "retain",
    where: (s) => ({ uploadedByUserId: s.userId }),
  },
  {
    model: "FieldSubmission",
    label: "Field submissions",
    // Same GPS/postcode caveat as ActivityRecord.
    erasureStrategy: "retain",
    where: (s) => ({
      OR: [{ submittedByUserId: s.userId }, { reviewedByUserId: s.userId }],
    }),
  },
  {
    model: "Comment",
    label: "Comments you authored",
    erasureStrategy: "redact",
    where: (s) => ({ authorUserId: s.userId }),
    redact: async (tx, s) => {
      await tx.comment.updateMany({
        where: { authorUserId: s.userId },
        data: { body: "[content removed at user's request]" },
      });
    },
  },
  {
    model: "DeviceToken",
    label: "Push notification device tokens",
    erasureStrategy: "delete",
    where: (s) => ({ userId: s.userId }),
  },
  {
    model: "SupplierDataRequest",
    label: "Supplier data requests",
    erasureStrategy: "redact",
    where: (s) => ({
      OR: [{ supplierEmail: s.email ?? EMAIL_FALLBACK }, { createdByUserId: s.userId }],
    }),
    redact: async (tx, s) => {
      // Only redact rows where the subject IS the named supplier contact
      // (verified by their own account email matching supplierEmail).
      // Rows matched only via createdByUserId belong to a *different*
      // person's supplier contact details — those are left untouched;
      // the creator's identity link is already severed by the User
      // tombstone.
      if (!s.email) return;
      await tx.supplierDataRequest.updateMany({
        where: { supplierEmail: s.email },
        data: { supplierEmail: "redacted@erased.invalid", supplierName: "Redacted" },
      });
    },
  },
  {
    model: "DigestPreference",
    label: "Email digest preferences",
    erasureStrategy: "delete",
    where: (s) => ({ userId: s.userId }),
  },
  {
    model: "Notification",
    label: "In-app notifications",
    erasureStrategy: "delete",
    where: (s) => ({ userId: s.userId }),
  },
  {
    model: "AuditLog",
    label: "Audit log entries you triggered",
    // Never deleted or altered — append-only and hash-chained (lib/db/audit.ts).
    // Identity is severed via the User tombstone; the tamper-evident chain
    // stays intact either way.
    erasureStrategy: "retain",
    where: (s) => ({ actorUserId: s.userId }),
  },
];

// Models with a userId/email-shaped field that are deliberately NOT in the
// registry above, with the reason why. The completeness test
// (lib/db/__tests__/pii-registry.test.ts) checks every DMMF model with an
// exact `userId` or `email` field is either registered or listed here.
export const PII_EXEMPT_MODELS: Record<string, string> = {
  OrganizationMembership:
    "RBAC graph edge, not a personal-data profile — erasing it mid-request could strip an active admin's access or break historical audit references. Requires an explicit org-offboarding decision, not automatic DSAR erasure.",
  PlatformMembership: "Same reasoning as OrganizationMembership, for platform staff.",
  ProjectRoleAssignment: "Same reasoning as OrganizationMembership, scoped to a project.",
  DsarRequest:
    "The request record itself, not a data category to fold into another export — already self-serviceable via GET /api/account/dsar. Including it here would also recurse (a DsarRequest row can point at a prior export's storage key).",
};

export function delegateNameFor(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}
