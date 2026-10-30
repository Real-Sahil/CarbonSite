import { createHash } from "node:crypto";

// The audit log's hash chain. Each organisation has one chain: a row's hash covers the previous
// row's hash and the row's own stored fields, so changing, removing or reordering a row breaks
// every hash after it.
//
// Version 2 rows (CHAIN_VERSION) hash exactly the values that are stored, so anyone holding the
// rows can recompute the hash: the timestamp is the stored created_at, the metadata is hashed with
// its keys sorted (the database does not keep key order), and the input is a JSON array so a "|"
// inside a field cannot shift one field into another. Older rows (hashVersion null) were hashed
// from values that were not all stored, so their contents cannot be re-checked; their links can.

export const CHAIN_VERSION = 2;

/**
 * Rows hashed over a float that the database then stored with fewer digits (1.8279515999999998
 * hashed, 1.8279516 stored), so their contents can never be recomputed. Found by the restore drill
 * on 30 Oct 2026; the rows are append-only and stay as written. They are checked as legacy rows
 * (link only) and listed here by hash so nothing else can hide behind the exception.
 */
export const FLOAT_DRIFT_HASHES: ReadonlySet<string> = new Set([
  "d3d00ba29e004c4e5727e51f93ce15b0ee81b108912b172ad6aba48719c2f9b7", // base_year.created, org cmtqvysuc0000ld04jh1ymbom, chainSeq 464
]);

/**
 * Rounds every non-integer number to 15 significant digits, which survives any trip through the
 * database's JSON storage. The writer hashes and stores this form, so the two always agree.
 */
export function stableNumbers<T>(value: T): T {
  if (typeof value === "number") return (Number.isInteger(value) ? value : Number(value.toPrecision(15))) as T;
  if (Array.isArray(value)) return value.map(stableNumbers) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stableNumbers(v)])) as T;
  }
  return value;
}

/** JSON with object keys sorted at every level, so the same data always gives the same text. */
export function canonicalJson(value: unknown): string {
  // A Date has no own keys, so it would hash as {}; hash it as the ISO string a stored row reads back as.
  if (value instanceof Date) return JSON.stringify(value);
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export interface HashedFields {
  previousHash: string | null;
  organizationId: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  createdAt: Date | string;
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export function rowHash(r: HashedFields): string {
  return createHash("sha256")
    .update(JSON.stringify([CHAIN_VERSION, r.previousHash ?? "", r.organizationId, r.actorUserId ?? "", r.action, r.resourceType, r.resourceId ?? "", canonicalJson(r.metadata ?? {}), iso(r.createdAt)]))
    .digest("hex");
}

export interface ChainRow {
  chainSeq: bigint | number | string;
  createdAt: Date | string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  previousHash: string | null;
  hash: string | null;
  hashVersion: number | null;
  /** Personal fields removed by the retention job; the stored hash stays, so only the link can be checked. */
  redactedAt?: Date | string | null;
}

export type BreakReason = "link" | "content" | "missing_hash";

export interface ChainResult {
  status: "empty" | "intact" | "broken";
  rows: number;
  /** Rows whose contents were recomputed and matched. */
  verified: number;
  /** Rows written before version 2: links checked, contents not. */
  legacy: number;
  /** Legacy rows whose link to the row before did not match (the old writer could fork under load). */
  legacyLinkBreaks: number;
  /** Rows anonymised after the retention period: links checked, contents not. */
  redacted: number;
  headSeq: string | null;
  headHash: string | null;
  firstBreak?: { chainSeq: string; reason: BreakReason };
}

/**
 * Checks rows in chain order, fed one at a time so a long chain never has to sit in memory.
 * `anchor` is the hash the first row must follow: null for the start of a chain, a hash for a
 * slice that begins part-way (a pack from a period start), undefined to skip that one link.
 */
export class ChainVerifier {
  private last: string | null | undefined;
  private res: ChainResult = { status: "empty", rows: 0, verified: 0, legacy: 0, legacyLinkBreaks: 0, redacted: 0, headSeq: null, headHash: null };

  constructor(private readonly organizationId: string, anchor?: string | null) {
    this.last = anchor;
  }

  get broken() {
    return this.res.firstBreak !== undefined;
  }

  feed(row: ChainRow): void {
    const r = this.res;
    if (r.firstBreak) return;
    r.rows++;
    const seq = String(row.chainSeq);
    const linked = this.last === undefined || (row.previousHash ?? null) === (this.last ?? null);
    if (row.redactedAt) {
      // Anonymised: the stored hash was kept so the next row still follows it, but the fields it
      // covered are gone. A redacted row must still carry a hash and sit in the chain.
      if (!row.hash) r.firstBreak = { chainSeq: seq, reason: "missing_hash" };
      else if (!linked) r.firstBreak = { chainSeq: seq, reason: "link" };
      else r.redacted++;
    } else if (row.hashVersion === CHAIN_VERSION && !(row.hash && FLOAT_DRIFT_HASHES.has(row.hash))) {
      if (!row.hash) r.firstBreak = { chainSeq: seq, reason: "missing_hash" };
      else if (!linked) r.firstBreak = { chainSeq: seq, reason: "link" };
      else if (rowHash({ ...row, organizationId: this.organizationId }) !== row.hash) r.firstBreak = { chainSeq: seq, reason: "content" };
      else r.verified++;
    } else {
      r.legacy++;
      if (!linked) r.legacyLinkBreaks++;
    }
    this.last = row.hash ?? null;
    r.headSeq = seq;
    r.headHash = row.hash ?? null;
  }

  result(): ChainResult {
    const r = this.res;
    return { ...r, status: r.rows === 0 ? "empty" : r.firstBreak ? "broken" : "intact" };
  }
}
