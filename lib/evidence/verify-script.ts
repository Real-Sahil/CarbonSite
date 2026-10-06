// Source of verify-evidence.mjs, written into every evidence bundle and assurance pack so a
// verifier can check the evidence on their own machine with nothing but Node. It repeats the
// canonical JSON and hash rules of lib/audit/chain.ts and lib/evidence/seal.ts in plain
// JavaScript; lib/evidence/__tests__/verify-script.test.ts runs it against real seals.

export const VERIFY_EVIDENCE_SCRIPT = String.raw`#!/usr/bin/env node
// Checks the evidence in this folder against evidence-manifest.json.
//   node verify-evidence.mjs
// Run it from the folder that holds evidence-manifest.json. Needs Node 18 or later and nothing else.
//
// 1. Every file listed is read and its SHA-256 compared with the manifest.
// 2. Every seal is recomputed from its payload, and the SHA-256 of each file inside it is compared
//    with the file in this folder.
// 3. If audit-log.csv is here, each seal's hash must appear in a record.sealed audit entry, and
//    each of those entries is recomputed from its own fields. This shows the seal was written into
//    the audit trail. Whether the whole trail is intact is checked by verify-audit-log.mjs.
// What this proves: nothing was altered after capture and sealing. It does not prove the photograph
// was honest when taken.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("evidence-manifest.json", "utf8"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
let failures = 0, notes = 0;
const bad = (m) => { failures++; console.log("FAIL  " + m); };
const note = (m) => { notes++; console.log("NOTE  " + m); };

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalJson(v === undefined ? null : v)).join(",") + "]";
  const entries = Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return "{" + entries.map(([k, v]) => JSON.stringify(k) + ":" + canonicalJson(v)).join(",") + "}";
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
const clean = (v) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v);

// 1. files
const present = new Map();
for (const f of manifest.files ?? []) {
  if (!existsSync(f.path)) { note(f.path + " is listed but not in this folder"); continue; }
  const h = sha(readFileSync(f.path));
  if (h !== f.sha256) bad(f.path + " has SHA-256 " + h + " but the manifest says " + f.sha256);
  else present.set(f.evidenceId, h);
}
console.log("Files checked: " + present.size + " of " + (manifest.files ?? []).length);

// 2. seals
const seals = manifest.seals ?? [];
for (const s of seals) {
  const label = "seal " + s.recordId + " v" + s.version;
  if (sha(canonicalJson(s.payload)) !== s.sealHash) { bad(label + ": the payload does not hash to the recorded seal hash"); continue; }
  for (const e of s.payload.evidence ?? []) {
    if (present.has(e.id) && present.get(e.id) !== e.sha256) bad(label + ": evidence " + e.id + " differs from the file sealed");
    else if (!present.has(e.id)) note(label + ": evidence " + e.id + " is not in this folder");
    if (e.verified === false) note(label + ": evidence " + e.id + " could not be read back by the server when sealed");
  }
}
console.log("Seals checked: " + seals.length);

// 3. audit trail
if (existsSync("audit-log.csv") && seals.length) {
  const table = parseCsv(readFileSync("audit-log.csv", "utf8")).filter((r) => r.length > 1);
  const head = table.shift() ?? [];
  const C = Object.fromEntries(["created_at", "actor_user_id", "action", "resource_type", "resource_id", "metadata", "previous_hash", "hash", "hash_version"].map((n) => [n, head.indexOf(n)]));
  const anchored = new Set();
  for (const f of table) {
    if (clean(f[C.action]) !== "record.sealed") continue;
    let metadata;
    try { metadata = JSON.parse(f[C.metadata] || "{}"); } catch { metadata = undefined; }
    if (f[C.hash_version] === "2" && metadata !== undefined) {
      const h = sha(JSON.stringify([2, f[C.previous_hash] || "", manifest.organisationId, clean(f[C.actor_user_id]) || "", "record.sealed", clean(f[C.resource_type]), clean(f[C.resource_id]) || "", canonicalJson(metadata), new Date(f[C.created_at]).toISOString()]));
      if (h !== f[C.hash]) { bad("audit entry for " + clean(f[C.resource_id]) + " does not match its recorded hash"); continue; }
    }
    if (metadata && metadata.sealHash) anchored.add(metadata.sealHash);
  }
  for (const s of seals) if (!anchored.has(s.sealHash)) bad("seal " + s.recordId + " v" + s.version + " is not recorded in the audit trail");
  console.log("Seals found in the audit trail: " + seals.filter((s) => anchored.has(s.sealHash)).length + " of " + seals.length);
} else if (seals.length) {
  note("No audit-log.csv here, so the seals were not checked against the audit trail");
}

console.log(failures ? "RESULT: " + failures + " PROBLEM(S) FOUND" : notes ? "RESULT: NO CHANGES FOUND (" + notes + " note(s) above)" : "RESULT: NO CHANGES FOUND");
process.exit(failures ? 1 : 0);
`;
