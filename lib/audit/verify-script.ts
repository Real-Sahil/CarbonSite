// Source of verify-audit-log.mjs, written into every assurance pack so a verifier can check the
// audit trail on their own machine with nothing but Node. It repeats lib/audit/chain.ts in plain
// JavaScript; lib/audit/__tests__/verify-script.test.ts runs both on the same rows so they cannot
// drift apart.

export const VERIFY_AUDIT_LOG_SCRIPT = String.raw`#!/usr/bin/env node
// Checks the hash chain in audit-log.csv from this pack.
//   node verify-audit-log.mjs audit-log.csv <organisation id>
// The organisation id is in README.txt. Needs Node 18 or later and nothing else.
//
// Each row's hash covers the row before it and the row's own fields, so changing, removing or
// reordering a row breaks every hash after it. Rows with an empty hash_version were written
// before the hash could be recomputed: their links are checked, their contents are not. Rows with a
// redacted_at value had their personal fields removed after the retention period: the stored hash is
// kept so the chain still links, but their contents cannot be rechecked.
// The first row of this file may start part-way through the organisation's chain, so its
// previous_hash is taken as given. Removing the newest rows leaves a shorter chain that is still
// consistent: compare the head hash printed below with a copy you hold from earlier.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const [file, organizationId] = process.argv.slice(2);
if (!file || !organizationId) {
  console.error("Usage: node verify-audit-log.mjs audit-log.csv <organisation id>");
  process.exit(2);
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// The pack prefixes a quote to text that starts with = + - @ so spreadsheets do not run it as a formula.
const clean = (v) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v);

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalJson(v === undefined ? null : v)).join(",") + "]";
  const entries = Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return "{" + entries.map(([k, v]) => JSON.stringify(k) + ":" + canonicalJson(v)).join(",") + "}";
}

const rowHash = (r) =>
  createHash("sha256")
    .update(JSON.stringify([2, r.previousHash ?? "", organizationId, r.actor ?? "", r.action, r.resourceType, r.resourceId ?? "", canonicalJson(r.metadata ?? {}), new Date(r.createdAt).toISOString()]))
    .digest("hex");

const table = parseCsv(readFileSync(file, "utf8")).filter((r) => r.length > 1);
const head = table.shift() ?? [];
const col = (name) => {
  const i = head.indexOf(name);
  if (i < 0) { console.error("audit-log.csv has no column " + name); process.exit(2); }
  return i;
};
const C = Object.fromEntries(["chain_seq", "created_at", "actor_user_id", "action", "resource_type", "resource_id", "metadata", "previous_hash", "hash", "hash_version"].map((n) => [n, col(n)]));
// Packs written before anonymisation existed have no redacted_at column.
const REDACTED = head.indexOf("redacted_at");

let last, verified = 0, redacted = 0, legacy = 0, legacyLinkBreaks = 0, headSeq = "", headHash = "", broken = null;
for (const f of table) {
  const seq = f[C.chain_seq];
  const hash = f[C.hash] || null;
  const previousHash = f[C.previous_hash] || null;
  const linked = last === undefined || previousHash === last;
  if (REDACTED >= 0 && f[REDACTED]) {
    if (!hash) broken = { seq, reason: "hash missing" };
    else if (!linked) broken = { seq, reason: "does not follow the row before it (a row was removed, added or reordered)" };
    else redacted++;
    if (broken) break;
  } else if (f[C.hash_version] === "2") {
    let metadata;
    try { metadata = JSON.parse(f[C.metadata] || "{}"); } catch { metadata = undefined; }
    const row = { previousHash, actor: clean(f[C.actor_user_id]) || null, action: clean(f[C.action]), resourceType: clean(f[C.resource_type]), resourceId: clean(f[C.resource_id]) || null, metadata, createdAt: f[C.created_at] };
    if (!hash) broken = { seq, reason: "hash missing" };
    else if (!linked) broken = { seq, reason: "does not follow the row before it (a row was removed, added or reordered)" };
    else if (metadata === undefined || rowHash(row) !== hash) broken = { seq, reason: "contents do not match the recorded hash (the row was changed)" };
    else verified++;
    if (broken) break;
  } else {
    legacy++;
    if (!linked) legacyLinkBreaks++;
  }
  last = hash;
  headSeq = seq;
  headHash = hash ?? "";
}

console.log("Rows read:               " + table.length);
console.log("Recomputed and matching: " + verified);
console.log("Anonymised (links only):  " + redacted);
console.log("Older rows (links only): " + legacy + (legacyLinkBreaks ? " (" + legacyLinkBreaks + " with a link mismatch)" : ""));
console.log("Last row checked:        " + (headSeq || "-") + (headHash ? "  hash " + headHash : ""));
if (broken) {
  console.log("RESULT: BROKEN at row " + broken.seq + ": " + broken.reason);
  process.exit(1);
}
console.log(table.length ? "RESULT: INTACT" : "RESULT: NO ROWS");
`;
