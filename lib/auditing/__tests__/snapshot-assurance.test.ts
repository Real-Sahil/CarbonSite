import { describe, it, expect } from "vitest";
import {
  AssuranceLevel,
  CreateAssuranceSchema,
  createDigitalSignature,
  verifyAssuranceSignature,
} from "../snapshot-assurance";
import crypto from "crypto";

describe("Snapshot Assurance", () => {
  it("should validate assurance creation schema", () => {
    const validAssurance = {
      publishedSnapshotId: "snap-123",
      auditorId: "auditor-456",
      auditorName: "Jane Smith",
      auditorEmail: "jane@auditor.co.uk",
      auditorOrganization: "Big Four Audit",
      assuranceLevel: AssuranceLevel.REASONABLE_ASSURANCE,
      totalEmissionsCo2e: 1000.5,
      reportingPeriodStart: "2026-01-01T00:00:00Z",
      reportingPeriodEnd: "2026-12-31T23:59:59Z",
      scopeStatement: "We have reviewed the company's Scope 1, 2, and 3 emissions calculations.",
      responsibilityStatement:
        "Management is responsible for the accuracy of emissions data. We are responsible for our opinion.",
      dataIntegrityHash: "abc123def456",
    };

    const result = CreateAssuranceSchema.safeParse(validAssurance);
    expect(result.success).toBe(true);
  });

  it("should reject missing required fields", () => {
    const invalidAssurance = {
      publishedSnapshotId: "snap-123",
      auditorId: "auditor-456",
      // Missing auditorName, auditorEmail, etc.
    };

    const result = CreateAssuranceSchema.safeParse(invalidAssurance);
    expect(result.success).toBe(false);
  });

  it("should reject invalid email", () => {
    const invalidEmail = {
      publishedSnapshotId: "snap-123",
      auditorId: "auditor-456",
      auditorName: "Jane Smith",
      auditorEmail: "not-an-email",
      assuranceLevel: AssuranceLevel.LIMITED_ASSURANCE,
      totalEmissionsCo2e: 500,
      reportingPeriodStart: "2026-01-01T00:00:00Z",
      reportingPeriodEnd: "2026-12-31T23:59:59Z",
      scopeStatement: "Scope statement",
      responsibilityStatement: "Responsibility statement",
      dataIntegrityHash: "hash123",
    };

    const result = CreateAssuranceSchema.safeParse(invalidEmail);
    expect(result.success).toBe(false);
  });

  it("should support all three assurance levels", () => {
    const levels = [
      AssuranceLevel.MANAGEMENT_ASSERTION,
      AssuranceLevel.LIMITED_ASSURANCE,
      AssuranceLevel.REASONABLE_ASSURANCE,
    ];

    for (const level of levels) {
      const assurance = {
        publishedSnapshotId: "snap-123",
        auditorId: "auditor-456",
        auditorName: "Auditor Name",
        auditorEmail: "auditor@test.com",
        assuranceLevel: level,
        totalEmissionsCo2e: 1000,
        reportingPeriodStart: "2026-01-01T00:00:00Z",
        reportingPeriodEnd: "2026-12-31T23:59:59Z",
        scopeStatement: "We have reviewed the emissions data",
        responsibilityStatement: "Management is responsible for the accuracy of the data",
        dataIntegrityHash: "hash",
      };

      const result = CreateAssuranceSchema.safeParse(assurance);
      expect(result.success).toBe(true);
    }
  });

  it("should create and verify digital signature", () => {
    // Generate test RSA key pair
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();

    const startDate = new Date("2026-01-01T00:00:00Z");
    const endDate = new Date("2026-12-31T00:00:00Z");

    const data = {
      totalEmissionsCo2e: 1500.5,
      reportingPeriodStart: startDate.toISOString(),
      reportingPeriodEnd: endDate.toISOString(),
    };

    const { signature, publicKeyThumbprint } = createDigitalSignature(data, privateKeyPem);

    expect(signature).toBeDefined();
    expect(signature.length).toBeGreaterThan(0);
    expect(publicKeyThumbprint).toBeDefined();

    // Verify signature with public key
    const assurance = {
      id: "assurance-1",
      publishedSnapshotId: "snap-123",
      organizationId: "org-456",
      auditorId: "auditor-789",
      auditorName: "Auditor",
      auditorEmail: "auditor@test.com",
      assuranceLevel: AssuranceLevel.REASONABLE_ASSURANCE,
      assuredAt: new Date(),
      reportingPeriodStart: startDate,
      reportingPeriodEnd: endDate,
      totalEmissionsCo2e: data.totalEmissionsCo2e,
      signatureAlgorithm: "sha256-rsa" as const,
      publicKeyThumbprint,
      digitalSignature: signature,
      scopeStatement: "Scope statement",
      responsibilityStatement: "Responsibility statement",
      dataIntegrityHash: "hash123",
      createdAt: new Date(),
    };

    const isValid = verifyAssuranceSignature(assurance, publicKeyPem);
    expect(isValid).toBe(true);
  });

  it("should detect tampered assurance data", () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();

    const originalData = {
      totalEmissionsCo2e: 1000,
      reportingPeriodStart: "2026-01-01",
      reportingPeriodEnd: "2026-12-31",
    };

    const { signature } = createDigitalSignature(originalData, privateKeyPem);

    // Tamper with the signature
    const tamperedSignature = signature
      .split("")
      .map((c, i) => (i === 0 ? (c === "a" ? "b" : "a") : c))
      .join("");

    const assurance = {
      id: "assurance-1",
      publishedSnapshotId: "snap-123",
      organizationId: "org-456",
      auditorId: "auditor-789",
      auditorName: "Auditor",
      auditorEmail: "auditor@test.com",
      assuranceLevel: AssuranceLevel.REASONABLE_ASSURANCE,
      assuredAt: new Date(),
      reportingPeriodStart: new Date("2026-01-01"),
      reportingPeriodEnd: new Date("2026-12-31"),
      totalEmissionsCo2e: originalData.totalEmissionsCo2e,
      signatureAlgorithm: "sha256-rsa" as const,
      publicKeyThumbprint: "test-thumbprint",
      digitalSignature: tamperedSignature,
      scopeStatement: "Scope",
      responsibilityStatement: "Responsibility",
      dataIntegrityHash: "hash123",
      createdAt: new Date(),
    };

    const isValid = verifyAssuranceSignature(assurance, publicKeyPem);
    expect(isValid).toBe(false);
  });
});
