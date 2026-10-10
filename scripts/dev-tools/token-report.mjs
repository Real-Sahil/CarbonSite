#!/usr/bin/env node
// Token and cache report for a Claude Code session transcript. Zero dependencies.
//
//   pnpm tokens                      newest session of this project
//   pnpm tokens path/to/session.jsonl
//   pnpm tokens --json               machine-readable
//
// The transcript logs one assistant message as several rows with the same usage, so rows are de-duplicated by
// message id (last row wins) before anything is added up. Without that every total is roughly doubled.
//
// What it answers: how big is each call's context (every call re-reads all of it), how much of that is the fixed
// floor (system prompt, CLAUDE.md, tool list), which events forced the cache to be rewritten, and which tools put
// the most text into the context. See docs/dev/TOKEN_STANDARDS.md for what to do about each.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const capArg = args.find((a) => a.startsWith("--cap="));
const CAP = capArg ? Number(capArg.slice(6)) : 200_000;
const file = args.find((a) => !a.startsWith("--")) ?? newestSession();

function newestSession() {
  const slug = process.cwd().replace(/[\\/]/g, "-");
  const dir = path.join(os.homedir(), ".claude", "projects", slug);
  if (!fs.existsSync(dir)) fail(`No transcripts at ${dir}. Pass a .jsonl path.`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }));
  if (!files.length) fail(`No .jsonl files in ${dir}.`);
  return path.join(dir, files.sort((a, b) => b.t - a.t)[0].f);
}
function fail(msg) { console.error(msg); process.exit(1); }

const calls = new Map(); // message id -> usage row
const toolName = new Map(); // tool_use id -> tool name
const toolChars = new Map();
let compactions = 0;

for (const line of fs.readFileSync(file, "utf8").split("\n")) {
  if (!line) continue;
  let d; try { d = JSON.parse(line); } catch { continue; }
  const m = d.message ?? {};
  let content = m.content;
  if (typeof content === "string") content = [{ type: "text", text: content }];
  if (Array.isArray(content)) {
    for (const b of content) {
      if (!b || typeof b !== "object") continue;
      if (b.type === "tool_use") toolName.set(b.id, b.name);
      else if (b.type === "tool_result") {
        const r = Array.isArray(b.content) ? b.content.map((x) => x?.text ?? "").join("") : String(b.content ?? "");
        const n = toolName.get(b.tool_use_id) ?? "?";
        const e = toolChars.get(n) ?? { calls: 0, chars: 0 };
        e.calls++; e.chars += r.length; toolChars.set(n, e);
      } else if (b.type === "text" && typeof b.text === "string" && b.text.includes("This session is being continued")) compactions++;
    }
  }
  const u = m.usage;
  if (d.type !== "assistant" || !u || m.model === "<synthetic>") continue;
  calls.set(m.id ?? d.uuid, {
    ts: Date.parse(d.timestamp), model: m.model,
    input: u.input_tokens ?? 0, write: u.cache_creation_input_tokens ?? 0, read: u.cache_read_input_tokens ?? 0, out: u.output_tokens ?? 0,
  });
}

const rows = [...calls.values()].sort((a, b) => a.ts - b.ts);
if (!rows.length) fail("No usage rows found in that transcript.");
const sum = (k, rs = rows) => rs.reduce((a, r) => a + r[k], 0);
const ctx = (r) => r.input + r.write + r.read;
const sorted = rows.map(ctx).sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

const byModel = {};
for (const r of rows) {
  const e = (byModel[r.model] ??= { calls: 0, write: 0, read: 0, out: 0 });
  e.calls++; e.write += r.write; e.read += r.read; e.out += r.out;
}

// Why were large chunks written to the cache? A write is paid once at a premium, so spikes are the avoidable cost.
const causes = { modelSwitch: { calls: 0, tokens: 0 }, idleOver1h: { calls: 0, tokens: 0 }, prefixChange: { calls: 0, tokens: 0 } };
for (let i = 1; i < rows.length; i++) {
  const r = rows[i], p = rows[i - 1];
  if (r.write < 100_000) continue;
  const c = r.model !== p.model ? causes.modelSwitch : r.ts - p.ts > 3_600_000 ? causes.idleOver1h : r.write / ctx(r) > 0.8 ? causes.prefixChange : null;
  if (c) { c.calls++; c.tokens += r.write; }
}

const aboveCap = rows.reduce((a, r) => a + (ctx(r) > CAP ? Math.min(r.read, ctx(r) - CAP) : 0), 0);
const tools = [...toolChars.entries()].map(([name, v]) => ({ name, calls: v.calls, approxTokens: Math.round(v.chars / 4) })).sort((a, b) => b.approxTokens - a.approxTokens).slice(0, 8);

const report = {
  file, calls: rows.length, compactions, models: byModel,
  totals: { input: sum("input"), cacheWrite: sum("write"), cacheRead: sum("read"), output: sum("out") },
  cacheReadShare: sum("read") / (sum("input") + sum("write") + sum("read")),
  context: { floor: sorted[0], median: pct(0.5), p90: pct(0.9), max: sorted[sorted.length - 1], callsAbove: Object.fromEntries([200_000, 400_000].map((t) => [t, sorted.filter((c) => c > t).length / sorted.length])) },
  cap: { tokens: CAP, shareOfReadsAboveCap: aboveCap / sum("read") },
  bigWritesByCause: causes, toolOutput: tools,
};

if (asJson) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }

const M = (n) => (n / 1e6).toFixed(1) + "M", K = (n) => Math.round(n / 1000) + "k";
console.log(`Session: ${path.basename(file)}   calls: ${report.calls} (de-duplicated)   compactions: ${compactions}`);
console.log(`Cache reads ${M(report.totals.cacheRead)} (${(report.cacheReadShare * 100).toFixed(1)}% of input)   writes ${M(report.totals.cacheWrite)}   output ${M(report.totals.output)}`);
for (const [m, v] of Object.entries(byModel)) console.log(`  ${m.padEnd(22)} ${String(v.calls).padStart(5)} calls   read ${M(v.read).padStart(8)}   write ${M(v.write).padStart(6)}   out ${M(v.out)}`);
console.log(`Context per call: floor ${K(report.context.floor)}  median ${K(report.context.median)}  p90 ${K(report.context.p90)}  max ${K(report.context.max)}`);
console.log(`  calls above 200k: ${(report.context.callsAbove[200000] * 100).toFixed(0)}%   above 400k: ${(report.context.callsAbove[400000] * 100).toFixed(0)}%`);
console.log(`  cache reads above a ${K(CAP)} context: ${(report.cap.shareOfReadsAboveCap * 100).toFixed(0)}% (what compacting at ${K(CAP)} would remove)`);
console.log("Large cache writes (>100k) by cause:");
for (const [k, v] of Object.entries(causes)) console.log(`  ${k.padEnd(13)} ${String(v.calls).padStart(3)} calls  ${M(v.tokens)}`);
console.log("Tool output kept in context (approx tokens):");
for (const t of tools) console.log(`  ${t.name.padEnd(34)} ${String(t.calls).padStart(5)} calls  ${K(t.approxTokens)}`);
