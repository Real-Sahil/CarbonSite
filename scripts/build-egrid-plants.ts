// Writes lib/factors/data/egrid-plants-2023.json: each eGRID2023 plant's position
// (2 decimals, about 1 km) and subregion, for the "nearest plants" subregion
// suggestion (lib/calculation/egrid-locate.ts).
//   pnpm tsx scripts/build-egrid-plants.ts data/sources/egrid2023_data_rev2.xlsx
import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const [, , file] = process.argv;
if (!file) throw new Error("Usage: pnpm tsx scripts/build-egrid-plants.ts <egrid2023_data_rev2.xlsx>");
const wb = XLSX.readFile(file, { sheets: ["PLNT23"] });
const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.PLNT23, { header: 1, defval: "" });
const header = rows[1] as string[];
const [iSub, iLat, iLon] = ["SUBRGN", "LAT", "LON"].map((n) => header.indexOf(n));
if ([iSub, iLat, iLon].some((i) => i < 0)) throw new Error("PLNT23 columns not found");
const subs: string[] = [];
const seen = new Set<string>();
const plants: [number, number, number][] = [];
for (const r of rows.slice(2)) {
  const [sub, lat, lon] = [r[iSub], r[iLat], r[iLon]];
  if (typeof sub !== "string" || !/^[A-Z]{4}$/.test(sub) || typeof lat !== "number" || typeof lon !== "number") continue;
  let idx = subs.indexOf(sub);
  if (idx < 0) idx = subs.push(sub) - 1;
  const p: [number, number, number] = [Number(lat.toFixed(2)), Number(lon.toFixed(2)), idx];
  const key = p.join(",");
  if (!seen.has(key)) { seen.add(key); plants.push(p); }
}
writeFileSync("lib/factors/data/egrid-plants-2023.json", JSON.stringify({ source: "EPA eGRID2023 revision 2, sheet PLNT23", subs, plants }));
console.log(`${plants.length} plant positions, ${subs.length} subregions`);
