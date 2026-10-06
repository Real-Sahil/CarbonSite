import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { rowHash } from "@/lib/audit/chain";
import { sealDifferences, sealHashOf, SEAL_VERSION, type SealPayload } from "../seal";
import { evidenceManifestJson } from "../bundle";
import { VERIFY_EVIDENCE_SCRIPT } from "../verify-script";

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const img = Buffer.from("not really a photo");
const payload: SealPayload = {
  v: SEAL_VERSION, recordId: "rec1", submissionId: "sub1", amount: "12.500000", unit: "tonne", activityDate: "2026-09-10", supplierName: "Aggregates Ltd", sourceDescription: "Type 1",
  fuelType: null, facilityId: null, siteId: "site1", contractId: null,
  evidence: [{ id: "ev1", sha256: sha(img), bytes: img.length, mime: "image/jpeg", verified: true }],
  capture: { deviceSubmittedAt: "2026-09-10T08:00:00.000Z", gpsLat: "51.4500000", gpsLng: "-1.0000000", ocrSha256: null },
  sealedBy: "u1", sealedAt: "2026-09-10T09:00:00.000Z", previousSealHash: null,
};

describe("sealDifferences", () => {
  const now = { amount: "12.5", unit: "tonne", activityDate: "2026-09-10", supplierName: "Aggregates Ltd", sourceDescription: "Type 1", fuelType: null, facilityId: null, siteId: "site1", contractId: null, evidence: [{ id: "ev1", sha256: sha(img) }] };
  it("unchanged record is clean, whatever the decimal places", () => expect(sealDifferences(payload, now)).toEqual([]));
  it("names what changed", () => {
    expect(sealDifferences(payload, { ...now, amount: "13" })).toContain("amount changed");
    expect(sealDifferences(payload, { ...now, supplierName: "Other" })).toContain("supplier changed");
    expect(sealDifferences(payload, { ...now, evidence: [] })).toContain("evidence ev1 removed");
    expect(sealDifferences(payload, { ...now, evidence: [{ id: "ev1", sha256: "x" }] })).toContain("evidence ev1 changed");
    expect(sealDifferences(payload, { ...now, evidence: [...now.evidence, { id: "ev2", sha256: "y" }] })).toContain("evidence ev2 added");
  });
});

describe("verify-evidence.mjs", () => {
  function bundle(opts: { tamperFile?: boolean; tamperSeal?: boolean; withAudit?: "ok" | "missing" | "none" } = {}) {
    const dir = mkdtempSync(join(tmpdir(), "evb-"));
    writeFileSync(join(dir, "ev1.jpg"), opts.tamperFile ? Buffer.from("edited") : img);
    const sealHash = sealHashOf(payload);
    const seal = { recordId: "rec1", version: 1, sealHash, sealedAt: payload.sealedAt, payload: opts.tamperSeal ? { ...payload, amount: "99" } : payload };
    writeFileSync(join(dir, "evidence-manifest.json"), evidenceManifestJson("org1", [{ path: "ev1.jpg", evidenceId: "ev1", sha256: sha(img), bytes: img.length }], [seal]));
    writeFileSync(join(dir, "verify-evidence.mjs"), VERIFY_EVIDENCE_SCRIPT);
    if (opts.withAudit && opts.withAudit !== "none") {
      const createdAt = "2026-09-10T09:00:00.000Z";
      const metadata = { sealHash: opts.withAudit === "ok" ? sealHash : "0".repeat(64), version: 1, evidence: [{ id: "ev1", sha256: sha(img) }] };
      const hash = rowHash({ previousHash: null, organizationId: "org1", actorUserId: "u1", action: "record.sealed", resourceType: "activity_record", resourceId: "rec1", metadata, createdAt });
      const csv = ["chain_seq,created_at,actor_user_id,action,resource_type,resource_id,metadata,previous_hash,hash,hash_version", `1,${createdAt},u1,record.sealed,activity_record,rec1,"${JSON.stringify(metadata).replace(/"/g, '""')}",,${hash},2`].join("\n") + "\n";
      writeFileSync(join(dir, "audit-log.csv"), csv);
    }
    return dir;
  }
  const run = (dir: string) => spawnSync("node", [join(dir, "verify-evidence.mjs")], { cwd: dir, encoding: "utf8" });

  it("passes an untouched bundle, anchored in the audit trail", () => {
    const r = run(bundle({ withAudit: "ok" }));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Seals found in the audit trail: 1 of 1");
  });
  it("passes without an audit log but says so", () => {
    const r = run(bundle());
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("not checked against the audit trail");
  });
  it("catches an edited image", () => {
    const r = run(bundle({ tamperFile: true, withAudit: "ok" }));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("FAIL  ev1.jpg");
  });
  it("catches an edited seal payload", () => {
    const r = run(bundle({ tamperSeal: true, withAudit: "ok" }));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("payload does not hash");
  });
  it("catches a seal that was never written to the audit trail", () => {
    const r = run(bundle({ withAudit: "missing" }));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("not recorded in the audit trail");
  });
});
