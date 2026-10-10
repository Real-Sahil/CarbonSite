import { describe, expect, it } from "vitest";
import { CHAIN_VERSION, ChainVerifier, canonicalJson, rowHash, type ChainRow } from "../chain";

const ORG = "org-1";
const t0 = new Date("2026-10-01T09:00:00.000Z");

/** Builds a valid version 2 chain of n rows. */
function chain(n: number, metaOf: (i: number) => unknown = () => ({})): ChainRow[] {
  const rows: ChainRow[] = [];
  let prev: string | null = null;
  for (let i = 0; i < n; i++) {
    const base = { actorUserId: i % 2 ? "u1" : null, action: "record.created", resourceType: "activity_record", resourceId: `r${i}`, metadata: metaOf(i), createdAt: new Date(t0.getTime() + i * 1000) };
    const hash = rowHash({ ...base, previousHash: prev, organizationId: ORG });
    rows.push({ chainSeq: i + 1, ...base, previousHash: prev, hash, hashVersion: CHAIN_VERSION });
    prev = hash;
  }
  return rows;
}
const run = (rows: ChainRow[], anchor?: string | null) => {
  const v = new ChainVerifier(ORG, anchor);
  rows.forEach((r) => v.feed(r));
  return v.result();
};

describe("canonicalJson", () => {
  it("sorts keys at every level and ignores insertion order", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } })).toBe('{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}');
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });
  it("drops undefined object values like JSON does", () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe("rowHash", () => {
  const f = { previousHash: null, organizationId: ORG, actorUserId: null, action: "a", resourceType: "t", resourceId: "x", metadata: { k: 1 }, createdAt: t0 };
  it("does not depend on metadata key order, and accepts the date as a string", () => {
    expect(rowHash({ ...f, metadata: { a: 1, b: 2 } })).toBe(rowHash({ ...f, metadata: { b: 2, a: 1 } }));
    expect(rowHash({ ...f, createdAt: t0.toISOString() })).toBe(rowHash(f));
  });
  it("cannot be fooled by a separator inside a field", () => {
    expect(rowHash({ ...f, action: "a|b", resourceType: "t" })).not.toBe(rowHash({ ...f, action: "a", resourceType: "b|t" }));
  });
});

describe("ChainVerifier", () => {
  it("passes an intact chain", () => {
    const r = run(chain(5, (i) => ({ n: i, z: 1, a: 2 })));
    expect(r).toMatchObject({ status: "intact", rows: 5, verified: 5, legacy: 0, headSeq: "5" });
  });
  it("reports an empty chain as empty, not intact", () => {
    expect(run([]).status).toBe("empty");
  });
  it("catches a changed field", () => {
    const rows = chain(5);
    rows[2] = { ...rows[2], action: "record.deleted" };
    expect(run(rows)).toMatchObject({ status: "broken", firstBreak: { chainSeq: "3", reason: "content" } });
  });
  it("catches changed metadata and a changed timestamp", () => {
    const a = chain(3); a[1] = { ...a[1], metadata: { tampered: true } };
    expect(run(a).firstBreak).toMatchObject({ chainSeq: "2", reason: "content" });
    const b = chain(3); b[1] = { ...b[1], createdAt: new Date(t0.getTime() + 999_000) };
    expect(run(b).firstBreak).toMatchObject({ chainSeq: "2", reason: "content" });
  });
  it("catches a removed row as a broken link at the next one", () => {
    const rows = chain(5);
    rows.splice(2, 1);
    expect(run(rows)).toMatchObject({ status: "broken", firstBreak: { chainSeq: "4", reason: "link" } });
  });
  it("catches reordered rows and an inserted row", () => {
    const rows = chain(4);
    [rows[1], rows[2]] = [rows[2], rows[1]];
    expect(run(rows).status).toBe("broken");
    const ins = chain(4);
    ins.splice(2, 0, chain(9)[7]);
    expect(run(ins).status).toBe("broken");
  });
  it("catches a version 2 row with its hash stripped", () => {
    const rows = chain(3);
    rows[1] = { ...rows[1], hash: null };
    expect(run(rows).firstBreak).toMatchObject({ chainSeq: "2", reason: "missing_hash" });
  });
  it("checks a slice that starts part-way against the hash it should follow", () => {
    const rows = chain(6);
    expect(run(rows.slice(3), rows[2].hash).status).toBe("intact");
    expect(run(rows.slice(3), "not-the-previous-hash").firstBreak?.reason).toBe("link");
    expect(run(rows.slice(3)).status).toBe("intact"); // no anchor: the first link is not checked
  });
  it("counts older rows without claiming their contents were verified", () => {
    const rows = chain(4);
    const legacy: ChainRow = { chainSeq: 0, createdAt: t0, actorUserId: null, action: "x", resourceType: "t", resourceId: "x", metadata: {}, previousHash: null, hash: "legacyhash", hashVersion: null };
    const first = chain(1)[0];
    // a version 2 row must follow the legacy row's hash
    const after = { ...first, previousHash: "legacyhash", hash: rowHash({ ...first, previousHash: "legacyhash", organizationId: ORG }) };
    const r = run([legacy, after]);
    expect(r).toMatchObject({ status: "intact", legacy: 1, verified: 1 });
    expect(run([legacy, rows[0]]).firstBreak?.reason).toBe("link"); // v2 row ignoring the legacy hash
    expect(run([{ ...legacy, hash: null }, { ...first, previousHash: null }]).status).toBe("intact"); // unhashed legacy row
  });
  it("counts anonymised rows without claiming their contents were verified", () => {
    const rows = chain(4, () => ({ secret: "name" }));
    const redact = (r: ChainRow): ChainRow => ({ ...r, actorUserId: null, metadata: { redacted: true }, redactedAt: new Date() });
    const r = run([redact(rows[0]), redact(rows[1]), rows[2], rows[3]]);
    expect(r).toMatchObject({ status: "intact", redacted: 2, verified: 2 });
    // links still checked: a removed row or a stripped hash breaks the chain
    expect(run([redact(rows[0]), rows[2]]).firstBreak?.reason).toBe("link");
    expect(run([{ ...redact(rows[0]), hash: null }]).firstBreak?.reason).toBe("missing_hash");
    // a changed row after a redacted one is still caught
    expect(run([redact(rows[0]), { ...rows[1], action: "x" }]).firstBreak?.reason).toBe("content");
  });
  it("counts a legacy link mismatch without failing the chain", () => {
    const l = (seq: number, prev: string | null, hash: string): ChainRow => ({ chainSeq: seq, createdAt: t0, actorUserId: null, action: "x", resourceType: "t", resourceId: "x", metadata: {}, previousHash: prev, hash, hashVersion: null });
    const r = run([l(1, null, "h1"), l(2, "h1", "h2"), l(3, "h1", "h3")]);
    expect(r).toMatchObject({ status: "intact", legacy: 3, legacyLinkBreaks: 1 });
  });
});
