// @vitest-environment node
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { csvLine } from "@/lib/assurance/pack";
import { CHAIN_VERSION, ChainVerifier, rowHash, type ChainRow } from "../chain";
import { VERIFY_AUDIT_LOG_SCRIPT } from "../verify-script";

const ORG = "org-9";
const HEADER = ["chain_seq", "created_at", "actor_user_id", "action", "resource_type", "resource_id", "metadata", "previous_hash", "hash", "hash_version", "redacted_at"];

function build(n: number): ChainRow[] {
  const rows: ChainRow[] = [];
  let prev: string | null = null;
  for (let i = 0; i < n; i++) {
    const f = {
      actorUserId: i % 3 ? "user-1" : null,
      action: "record.created",
      resourceType: "activity_record",
      resourceId: i === 2 ? "-starts-with-dash" : `r|${i}`,
      metadata: i === 1 ? { zeta: 1, alpha: { b: "a,b \"quoted\"\nline", a: [1, 2] } } : { n: i },
      createdAt: new Date(Date.UTC(2026, 9, 1, 9, 0, i, 123)),
    };
    const hash = rowHash({ ...f, previousHash: prev, organizationId: ORG });
    rows.push({ chainSeq: i + 1, ...f, previousHash: prev, hash, hashVersion: CHAIN_VERSION });
    prev = hash;
  }
  return rows;
}

// Written the way the pack writes it: metadata as the database hands it back (keys re-ordered).
function csv(rows: ChainRow[]): string {
  let out = csvLine(HEADER);
  for (const r of rows) {
    const meta = r.metadata as Record<string, unknown>;
    const reordered = Object.fromEntries(Object.entries(meta).reverse());
    out += csvLine([r.chainSeq, (r.createdAt as Date).toISOString(), r.actorUserId, r.action, r.resourceType, r.resourceId, reordered, r.previousHash, r.hash, r.hashVersion, r.redactedAt ? new Date(r.redactedAt).toISOString() : ""]);
  }
  return out;
}

const dir = mkdtempSync(join(tmpdir(), "verify-"));
const script = join(dir, "verify-audit-log.mjs");
writeFileSync(script, VERIFY_AUDIT_LOG_SCRIPT);

function runScript(text: string): { code: number; out: string } {
  const file = join(dir, "audit-log.csv");
  writeFileSync(file, text);
  try {
    return { code: 0, out: execFileSync("node", [script, file, ORG], { encoding: "utf8" }) };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { code: err.status, out: err.stdout };
  }
}
const lib = (rows: ChainRow[]) => {
  const v = new ChainVerifier(ORG);
  rows.forEach((r) => v.feed(r));
  return v.result();
};

describe("verify-audit-log.mjs agrees with the library", () => {
  it("passes an intact chain, including awkward characters and a key re-order", () => {
    const rows = build(6);
    expect(lib(rows).status).toBe("intact");
    const r = runScript(csv(rows));
    expect(r.code).toBe(0);
    expect(r.out).toContain("RESULT: INTACT");
    expect(r.out).toContain("Recomputed and matching: 6");
  });

  it("finds the same changed row", () => {
    const rows = build(6);
    const bad = rows.map((r, i) => (i === 3 ? { ...r, action: "record.deleted" } : r));
    expect(lib(bad).firstBreak).toMatchObject({ chainSeq: "4", reason: "content" });
    const r = runScript(csv(bad));
    expect(r.code).toBe(1);
    expect(r.out).toContain("BROKEN at row 4");
  });

  it("finds the same removed row", () => {
    const rows = build(6);
    const bad = rows.filter((_, i) => i !== 2);
    expect(lib(bad).firstBreak).toMatchObject({ chainSeq: "4", reason: "link" });
    const r = runScript(csv(bad));
    expect(r.code).toBe(1);
    expect(r.out).toContain("BROKEN at row 4");
  });

  it("accepts a slice that starts part-way and counts older rows without claiming them verified", () => {
    const rows = build(6);
    const r = runScript(csv(rows.slice(2)));
    expect(r.code).toBe(0);
    const legacy: ChainRow = { chainSeq: 0, createdAt: new Date(), actorUserId: null, action: "x", resourceType: "t", resourceId: "x", metadata: {}, previousHash: null, hash: "old", hashVersion: null };
    const mixed = runScript(csv([legacy, ...rows.slice(0, 1).map((x) => ({ ...x, previousHash: "old", hash: rowHash({ ...x, previousHash: "old", organizationId: ORG }) }))]));
    expect(mixed.out).toContain("Older rows (links only): 1");
    expect(mixed.out).toContain("Recomputed and matching: 1");
  });

  it("counts anonymised rows by their links and still catches a break after them", () => {
    const rows = build(6);
    const redact = (r: ChainRow): ChainRow => ({ ...r, actorUserId: null, metadata: { redacted: true }, redactedAt: new Date("2033-01-01T00:00:00Z") });
    const mixed = [redact(rows[0]), redact(rows[1]), ...rows.slice(2)];
    expect(lib(mixed)).toMatchObject({ status: "intact", redacted: 2, verified: 4 });
    const r = runScript(csv(mixed));
    expect(r.code).toBe(0);
    expect(r.out).toContain("Anonymised (links only):  2");
    expect(r.out).toContain("Recomputed and matching: 4");
    const bad = mixed.map((x, i) => (i === 4 ? { ...x, action: "record.deleted" } : x));
    expect(runScript(csv(bad)).code).toBe(1);
    const gap = mixed.filter((_, i) => i !== 1);
    expect(lib(gap).firstBreak?.reason).toBe("link");
    expect(runScript(csv(gap)).code).toBe(1);
  });
});
