// Engagement lifecycle rules.
//
// An opinion is not just a status flip. Signing off requires every material
// finding to be resolved (not merely responded to) and every evidence request
// to be settled one way or another, because an unresolved PBC item is a scope
// limitation the opinion must either wait for or explicitly qualify around.

import type { FindingSeverity, FindingStatus, EvidenceRequestStatus } from "@prisma/client";

const BLOCKING_FINDING_SEVERITIES: ReadonlySet<FindingSeverity> = new Set<FindingSeverity>([
  "significant",
  "material_misstatement",
]);

const UNRESOLVED_FINDING_STATUSES: ReadonlySet<FindingStatus> = new Set<FindingStatus>([
  "open",
  "management_responded",
]);

const UNSETTLED_EVIDENCE_STATUSES: ReadonlySet<EvidenceRequestStatus> = new Set<EvidenceRequestStatus>([
  "requested",
]);

export interface SignOffCheck {
  canSignOff: boolean;
  blockers: string[];
}

/**
 * Whether an engagement can move to "signed".
 *
 * A minor or observation-level finding does not block sign-off — those are
 * routinely noted in the report without changing the opinion. A significant
 * or material finding does, unless it has been formally qualified (the
 * assuror's decision to issue a qualified opinion rather than wait).
 */
export function checkSignOffReadiness(params: {
  findings: Array<{ severity: FindingSeverity; status: FindingStatus }>;
  evidenceRequests: Array<{ reference: string; status: EvidenceRequestStatus }>;
}): SignOffCheck {
  const blockers: string[] = [];

  const blockingFindings = params.findings.filter(
    (f) => BLOCKING_FINDING_SEVERITIES.has(f.severity) && UNRESOLVED_FINDING_STATUSES.has(f.status),
  );
  if (blockingFindings.length > 0) {
    blockers.push(
      `${blockingFindings.length} significant or material finding${blockingFindings.length === 1 ? "" : "s"} not yet resolved or qualified.`,
    );
  }

  const outstandingEvidence = params.evidenceRequests.filter((e) =>
    UNSETTLED_EVIDENCE_STATUSES.has(e.status),
  );
  if (outstandingEvidence.length > 0) {
    blockers.push(
      `${outstandingEvidence.length} evidence request${outstandingEvidence.length === 1 ? "" : "s"} still outstanding: ${outstandingEvidence
        .slice(0, 3)
        .map((e) => e.reference)
        .join(", ")}${outstandingEvidence.length > 3 ? ", …" : ""}.`,
    );
  }

  return { canSignOff: blockers.length === 0, blockers };
}

/**
 * Whether a finding's severity, on its own, is enough to justify a qualified
 * opinion rather than a clean one — the material misstatement tier.
 */
export function requiresQualification(severity: FindingSeverity): boolean {
  return severity === "material_misstatement";
}
