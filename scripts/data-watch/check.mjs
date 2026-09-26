// Checks every external data source the platform loads and reports what the
// publisher has released that the repo does not have yet.
//
//   node scripts/data-watch/check.mjs            print the report
//   node scripts/data-watch/check.mjs --issues   also open a GitHub issue per
//                                                finding (GITHUB_TOKEN and
//                                                GITHUB_REPOSITORY required)
//
// A watcher that cannot reach its source, or finds the page changed shape,
// opens an issue too: silence must mean "nothing new", never "not checked".
// Run weekly by .github/workflows/data-upkeep.yml. CPI is not here: the
// workflow updates it itself (update-cpi.mjs) and opens a pull request.
import { readFileSync } from "node:fs";
import {
  calendarLastChecked,
  compareVersions,
  daysBetween,
  defraFlatFile,
  epaHubYear,
  latestDefraPublication,
  parseDefraReleases,
  ukFootprintYear,
} from "./lib.mjs";

const ROOT = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const loaded = JSON.parse(read("data/sources/watched-sources.json"));
const UA = { "User-Agent": "MetricOra data upkeep (github.com/Real-Sahil/CarbonSite)" };

async function getJson(url) {
  const r = await fetch(url, { headers: { ...UA, Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return r.json();
}
async function getText(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return r.text();
}

const watchers = [
  {
    id: "defra",
    name: "DESNZ/DEFRA GHG conversion factors",
    async check() {
      const releases = parseDefraReleases(read("scripts/build-defra-factors.mjs"));
      const have = releases.at(-1);
      if (!have) throw new Error("no RELEASES found in scripts/build-defra-factors.mjs");
      const collection = await getJson("https://www.gov.uk/api/content/government/collections/government-conversion-factors-for-company-reporting");
      const latest = latestDefraPublication(collection);
      if (!latest) throw new Error("the GOV.UK collection lists no conversion factors publication");
      const pub = await getJson(`https://www.gov.uk/api/content${latest.basePath}`);
      const flat = defraFlatFile(pub);
      const page = `https://www.gov.uk${latest.basePath}`;
      const updated = String(pub.public_updated_at ?? "").slice(0, 10);
      if (latest.year > have.year) {
        return {
          title: `Data upkeep: DEFRA conversion factors ${latest.year} published`,
          body: [
            `DESNZ has published **${latest.title}** (${page}). The repo loads ${have.year} (library ${have.library}).`,
            "",
            flat ? `Flat file: [${flat.title}](${flat.url})` : "No flat file attachment found yet; DESNZ sometimes adds it later.",
            "",
            "To load it:",
            `1. Download the flat file and add a \`${latest.year}\` entry to \`RELEASES\` in \`scripts/build-defra-factors.mjs\` (check the row names that changed: HGV, waste combustion, recycling).`,
            `2. \`node scripts/build-defra-factors.mjs <flat-file.xlsx> ${latest.year}\` writes \`prisma/data/defra-${latest.year}-factors.json\` and the migration.`,
            "3. Run the factor tests (`pnpm vitest run lib/calculation`), then `chooseFactorLibrary()` picks the new library for periods ending in that year.",
          ].join("\n"),
        };
      }
      if (latest.year === have.year && updated && updated > have.published) {
        return {
          title: `Data upkeep: DEFRA conversion factors ${have.year} revised on ${updated}`,
          body: [
            `The ${have.year} publication (${page}) was updated on ${updated}; the repo loads flat file v${have.fileVersion} published ${have.published}.`,
            flat ? `Flat file: [${flat.title}](${flat.url})` : "",
            "",
            "Check the change history on the page. If the flat file changed, download it, bump `fileVersion`/`published` in `RELEASES` and rebuild with `scripts/build-defra-factors.mjs`. Otherwise update `published` so this stops firing.",
          ].join("\n"),
        };
      }
      return null;
    },
  },
  {
    id: "uk-spend",
    name: "Defra UK spend-based emissions multipliers",
    async check() {
      const have = loaded["uk-spend-multipliers"];
      const page = "https://www.gov.uk/government/statistics/uks-carbon-footprint";
      const json = await getJson("https://www.gov.uk/api/content/government/statistics/uks-carbon-footprint");
      const year = ukFootprintYear(json.title);
      if (!year) throw new Error(`the statistics page title no longer reads "... carbon footprint to <year>": "${json.title}"`);
      if (year <= have.toYear) return null;
      const latest = { year };
      return {
        title: `Data upkeep: UK carbon footprint to ${latest.year} (spend multipliers) published`,
        body: [
          `Defra has published the UK carbon footprint to ${latest.year}: ${page}. The repo loads multipliers to ${have.toYear}.`,
          "",
          "To load it: extract sheet GHG_SIC_multipliers into `data/sources/` in the same format as `uk-spend-multipliers-sic-2015-2023.txt` (source URL and sha256 in the header), run `pnpm tsx scripts/build-uk-spend-factors.ts <extract> <migration>`, then set `toYear` and `published` in `data/sources/watched-sources.json`.",
          "Defra plans a different channel for these multipliers from 2027; if this publication no longer has them, find where they moved.",
        ].join("\n"),
      };
    },
  },
  {
    id: "epa-hub",
    name: "EPA GHG Emission Factors Hub",
    async check() {
      const have = loaded["epa-ghg-hub"];
      const url = "https://www.epa.gov/climateleadership/ghg-emission-factors-hub";
      const year = epaHubYear(await getText(url));
      if (!year) throw new Error("no ghg-emission-factors-hub-<year> file linked from the hub page");
      if (year <= have.year) return null;
      return {
        title: `Data upkeep: EPA GHG Emission Factors Hub ${year} published`,
        body: `EPA's hub (${url}) now links the ${year} factors; the repo loads ${have.year}. Transcribe the new PDF into a factor migration as for EPA 2025.1, then set \`year\` in \`data/sources/watched-sources.json\`.`,
      };
    },
  },
  {
    id: "useeio",
    name: "EPA Supply Chain GHG Emission Factors (USEEIO)",
    async check() {
      const have = loaded["epa-useeio"];
      const rel = await getJson("https://api.github.com/repos/USEPA/supply-chain-factors/releases/latest");
      const tag = String(rel.tag_name ?? "");
      if (!/\d/.test(tag)) throw new Error(`unexpected latest release tag '${tag}'`);
      if (compareVersions(tag, have.version) <= 0) return null;
      return {
        title: `Data upkeep: EPA Supply Chain GHG Emission Factors ${tag} released`,
        body: `EPA released ${tag} (${rel.html_url}); the repo loads v${have.version} as "EPA USEEIO ${have.version.split(".").slice(0, 2).join(".")}". Download the NAICS-6 CSV into \`data/sources/\`, run \`pnpm tsx scripts/build-useeio-factors.ts <csv> <migration>\` (check the price year), then set \`version\` in \`data/sources/watched-sources.json\`.`,
      };
    },
  },
  {
    id: "ademe",
    name: "ADEME Base Carbone",
    async check() {
      const have = loaded["ademe-base-carbone"];
      const meta = await getJson("https://data.ademe.fr/data-fair/api/v1/datasets/base-carboner");
      const updated = String(meta.dataUpdatedAt ?? meta.updatedAt ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(updated)) throw new Error("the dataset metadata has no update date");
      if (updated <= have.modified) return null;
      return {
        title: `Data upkeep: ADEME Base Carbone updated on ${updated}`,
        body: `The Base Carbone dataset (https://data.ademe.fr/datasets/base-carboner) changed on ${updated}; the repo loads the export last modified ${have.modified}. Download the full CSV to \`data/sources/ademe-base-carbone.csv\` and run \`pnpm tsx scripts/build-ademe-factors.ts <csv> <migration> --after <latest ADEME migration dir>\` (it loads only factors not already loaded), then set \`modified\` in \`data/sources/watched-sources.json\`.`,
      };
    },
  },
  {
    id: "calendar",
    name: "Regulatory calendar",
    async check() {
      const src = read("app/(app)/orgs/[orgId]/compliance/deadlines/page.tsx");
      const checked = calendarLastChecked(src);
      if (!checked) throw new Error("LAST_CHECKED not found in the regulatory calendar page");
      const age = daysBetween(checked, new Date());
      if (age <= loaded["regulatory-calendar"].maxAgeDays) return null;
      const sources = [...new Set([...src.matchAll(/source: '([^']+)'/g)].map((m) => m[1]))];
      return {
        title: `Data upkeep: regulatory calendar last checked ${age} days ago`,
        body: [
          `The deadlines on Compliance → Deadlines were last checked on ${checked.toISOString().slice(0, 10)}. Recheck each date, threshold and penalty against its source, add new deadlines, drop lapsed ones, and move \`LAST_CHECKED\`.`,
          "",
          ...sources.map((s) => `- ${s}`),
        ].join("\n"),
      };
    },
  },
];

async function run() {
  const findings = [];
  for (const w of watchers) {
    try {
      const f = await w.check();
      console.log(`${f ? "NEW " : "ok  "} ${w.name}${f ? `: ${f.title}` : ""}`);
      if (f) findings.push(f);
    } catch (err) {
      console.log(`FAIL ${w.name}: ${err.message}`);
      findings.push({
        title: `Data upkeep: ${w.name} watcher failed`,
        body: `\`scripts/data-watch/check.mjs\` could not check ${w.name}:\n\n\`\`\`\n${err.message}\n\`\`\`\n\nThe source may be down or may have changed its page or API. Until this is fixed, new releases from it are not being noticed.`,
      });
    }
  }
  if (process.argv.includes("--issues")) await openIssues(findings);
  return findings;
}

async function gh(path, init = {}) {
  const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...UA,
    },
  });
  if (!r.ok && r.status !== 422) throw new Error(`GitHub ${path} answered ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

async function openIssues(findings) {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) throw new Error("--issues needs GITHUB_TOKEN and GITHUB_REPOSITORY");
  // The label may already exist (422).
  await gh("/labels", { method: "POST", body: JSON.stringify({ name: "data-upkeep", color: "0e8a16", description: "A data source has something new, or its watcher broke" }) });
  const open = await gh("/issues?state=open&labels=data-upkeep&per_page=100");
  const titles = new Set((open ?? []).map((i) => i.title));
  for (const f of findings) {
    if (titles.has(f.title)) {
      console.log(`issue already open: ${f.title}`);
      continue;
    }
    const issue = await gh("/issues", { method: "POST", body: JSON.stringify({ title: f.title, body: f.body, labels: ["data-upkeep"] }) });
    console.log(`opened #${issue?.number}: ${f.title}`);
  }
}

await run();
