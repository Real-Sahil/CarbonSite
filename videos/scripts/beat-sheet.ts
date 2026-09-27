/**
 * Writes the launch film's beat sheet (the doc the product owner reads) from cues.ts.
 *   bun scripts/beat-sheet.ts > src/videos/launch/BEAT-SHEET.md
 */
import { CARDS } from "../src/videos/launch/acts/Brand";
import { BARS, CUE, DURATION, GRID } from "../src/videos/launch/cues";

const bar = (s: number) => {
  const beats = s / (60 / GRID.bpm);
  const b = Math.floor(beats / 4) + 1;
  const beat = beats - (b - 1) * 4 + 1;
  return `${b}.${Number.isInteger(beat) ? beat : beat.toFixed(1)}`;
};
const rows: [number, string][] = [];
for (const [act, cues] of Object.entries(CUE)) for (const [name, s] of Object.entries(cues)) rows.push([s, `${act}.${name}`]);
for (const card of CARDS) rows.push([card.lines[0][0].at, `words: "${card.lines.map((l) => l.map((w) => w.text).join(" ")).join(" ")}"`]);
rows.sort((a, b) => a[0] - b[0]);
console.log(`# Launch film beat sheet\n\n${GRID.bpm} BPM, 4/4, ${BARS} bars, ${DURATION} s. Generated from cues.ts.\n`);
console.log("| Time (s) | Bar.beat | Cue |\n|---:|---|---|");
for (const [s, name] of rows) console.log(`| ${s.toFixed(2)} | ${bar(s)} | ${name} |`);
