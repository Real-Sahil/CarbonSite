// Snapshot Assurance — auditor sign-off and cryptographic attestation workflow
// Implements digital signing of published emissions snapshots for regulatory compliance

import crypto from "crypto";
import { z } from "zod";

export enum AssuranceLevel {
  UNASSURED = "unassured",
  MANAGEMENT_ASSERTION = "management", // Signed by org staff
  LIMITED_ASSURANCE = "limited", // Independent verifier, reasonable procedures
  REASONABLE_ASSURANCE = "reasonable", // Independent verifier, comprehensive procedures
}

export interface SnapshotAssurance {
  id: string;
  publishedSnapshotId: string;
  organizationId: string;

  // Who performed the assurance
  auditorId: string;
  auditorName: string;
  auditorOrganization?: string; // Third-party auditor
  auditorEmail: string;

  // When and what was assured
  assuranceLevel: AssuranceLevel;
  assuredAt: Date;
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;

  // Cryptographic attestation
  totalEmissionsCo2e: number; // The value being signed
  signatureAlgorithm: "sha256-rsa" | "sha256-ecdsa"; // Signing method
  publicKeyThumbprint: string; // For key rotation tracking
  digitalSignature: string; // Base64-encoded signature

  // Statement and scope
  scopeStatement: string; // What was reviewed
  limitationsStatement?: string; // Known limitations or exclusions
  responsibilityStatement: string; // Who's responsible for what

  // Evidence reference
  workingPaperFileId?: string; // R2 storage key to audit documentation
  dataQualityAssertions?: string[]; // Specific facts asserted about data

  // Chain-of-custody
  dataIntegrityHash: string; // SHA-256 of snapshot data at time of signing
  previousAssuranceId?: string; // Links to prior year's assurance for trend comparison

  createdAt: Date;
  updatedAt?: Date;
  revokedAt?: Date;
  revocationReason?: string; // Why assurance was withdrawn (e.g., "data correction required")
}

/**
 * Create cryptographic signature for snapshot assurance
 * Simulates RSA-SHA256 signing; real implementation would use HSM or cloud signing service
 */
export function createDigitalSignature(
  data: { totalEmissionsCo2e: number; reportingPeriodStart: string; reportingPeriodEnd: string },
  privateKeyPem: string // PEM-formatted private key (from secure storage)
): { signature: string; publicKeyThumbprint: string } {
  // For demonstration: hash the JSON payload
  const payload = JSON.stringify(data);
  const hash = crypto.createHash("sha256").update(payload).digest();

  // Sign with private key (in production, use HSM/cloud signing)
  const sign = crypto.createSign("sha256");
  sign.update(payload);
  const signature = sign.sign(privateKeyPem, "base64");

  // Extract public key thumbprint for key tracking
  const keyHash = crypto
    .createHash("sha256")
    .update(privateKeyPem.split("\n").slice(1, -1).join("")) // Remove PEM headers
    .digest("hex")
    .substring(0, 16);

  return { signature, publicKeyThumbprint: keyHash };
}

/**
 * Verify snapshot assurance signature (for auditors/compliance checks)
 */
export function verifyAssuranceSignature(
  assurance: SnapshotAssurance,
  publicKeyPem: string
): boolean {
  try {
    const data = {
      totalEmissionsCo2e: assurance.totalEmissionsCo2e,
      reportingPeriodStart: assurance.reportingPeriodStart.toISOString(),
      reportingPeriodEnd: assurance.reportingPeriodEnd.toISOString(),
    };

    const payload = JSON.stringify(data);
    const verify = crypto.createVerify("sha256");
    verify.update(payload);

    return verify.verify(publicKeyPem, Buffer.from(assurance.digitalSignature, "base64"));
  } catch (err) {
    console.error("[assurance] Signature verification failed:", err);
    return false;
  }
}

/**
 * Schema for creating a new assurance record
 */
export const CreateAssuranceSchema = z.object({
  publishedSnapshotId: z.string().min(1),
  auditorId: z.string().min(1),
  auditorName: z.string().min(1),
  auditorEmail: z.string().email(),
  auditorOrganization: z.string().optional(),
  assuranceLevel: z.enum([
    AssuranceLevel.MANAGEMENT_ASSERTION,
    AssuranceLevel.LIMITED_ASSURANCE,
    AssuranceLevel.REASONABLE_ASSURANCE,
  ]),
  totalEmissionsCo2e: z.number().nonnegative(),
  reportingPeriodStart: z.string().datetime(),
  reportingPeriodEnd: z.string().datetime(),
  scopeStatement: z.string().min(10),
  limitationsStatement: z.string().optional(),
  responsibilityStatement: z.string().min(10),
  workingPaperFileId: z.string().optional(),
  dataQualityAssertions: z.array(z.string()).optional(),
  dataIntegrityHash: z.string(), // SHA-256 hex string
});

export type CreateAssuranceRequest = z.infer<typeof CreateAssuranceSchema>;

/**
 * Audit trail: track assurance lifecycle events
 */
export const AssuranceAuditEvent = z.object({
  assuranceId: z.string(),
  timestamp: z.date(),
  actor: z.object({
    userId: z.string(),
    role: z.enum(["auditor", "organization_admin", "platform_admin"]),
  }),
  event: z.enum([
    "assurance_created",
    "assurance_verified", // by second auditor
    "assurance_published",
    "assurance_withdrawn", // revoked
  ]),
  notes: z.string().optional(),
});
