/**
 * Builds the transfer-note test corpus, renders each note to a real PDF with headless Chromium, reads it with the
 * production reader (PDF text layer, then the extractor) and scores every field against the known answer.
 *
 *   pnpm tsx scripts/waste-corpus/run.mts                 # score all three sets
 *   pnpm tsx scripts/waste-corpus/run.mts --write-fixture # also refresh lib/waste/__tests__/fixtures/transfer-note-corpus.json
 *
 * Set A was used to write the reader's rules; B and C were written afterwards (C was never tuned against). All are
 * synthetic, written to look like the layouts UK carriers use. They are not real customer documents, so the scores
 * measure the reader on these layouts, not on any customer's own paperwork.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer";
import { documentText } from "../../lib/imports/parsers/pdf";
import { extractTransferNote } from "../../lib/waste/transfer-note-extractor";
import { build as buildA } from "./gen-a";
import { build as buildB } from "./gen-b";
import { build as buildC } from "./gen-c";

type AnyNote = { id: string; layout: string; html: string; truth: Record<string, string | number | null> };
const SETS: { name: string; notes: AnyNote[] }[] = [
  { name: "A", notes: buildA(40) as AnyNote[] },
  { name: "B", notes: buildB(30) as AnyNote[] },
  { name: "C", notes: buildC() as AnyNote[] },
];
const FIELDS = ["reference", "carrierRegistration", "ewc", "tonnes", "date", "vehicle", "carrier"] as const;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wtn-corpus-"));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const fixture: { set: string; id: string; layout: string; text: string; truth: AnyNote["truth"] }[] = [];

for (const set of SETS) {
  let right = 0, wrong = 0, missing = 0, falsePositive = 0;
  const lines: string[] = [];
  for (const n of set.notes) {
    const file = path.join(tmp, `${set.name}-${n.id}.pdf`);
    const page = await browser.newPage();
    await page.setContent(n.html);
    await page.pdf({ path: file, format: "A4" });
    await page.close();
    const { text } = await documentText(fs.readFileSync(file), "application/pdf");
    fixture.push({ set: set.name, id: n.id, layout: n.layout, text, truth: n.truth });
    const got = extractTransferNote(text) as Record<string, unknown>;
    for (const f of FIELDS) {
      const want = n.truth[f];
      const g = got[f];
      if (want === null) { if (g !== undefined) { falsePositive++; lines.push(`${n.id} ${f}: read ${JSON.stringify(g)} from a document that is not a transfer note`); } continue; }
      const same = f === "carrier" ? String(g ?? "").toLowerCase().includes(String(want).toLowerCase().split(" ")[0]) : String(g) === String(want);
      if (g === undefined) { missing++; lines.push(`${n.id} ${f}: missing (want ${want})`); }
      else if (same) right++;
      else { wrong++; lines.push(`${n.id} ${f}: WRONG got ${JSON.stringify(g)} want ${JSON.stringify(want)}`); }
    }
  }
  console.log(`Set ${set.name}: ${set.notes.length} documents, fields right ${right}, wrong ${wrong}, missing ${missing}, read from non-notes ${falsePositive}`);
  if (lines.length) console.log(lines.map((l) => `   ${l}`).join("\n"));
}
await browser.close();
if (process.argv.includes("--write-fixture")) {
  const out = path.join(process.cwd(), "lib/waste/__tests__/fixtures/transfer-note-corpus.json");
  fs.writeFileSync(out, JSON.stringify(fixture, null, 1));
  console.log(`wrote ${fixture.length} documents to ${out}`);
}
