// Build a management-systems catalogue from a NIST OSCAL catalogue.
//
//   pnpm tsx scripts/management-systems/build-oscal.ts sp800-53 <oscal-content>/nist.gov/SP800-53/rev5/json
//   pnpm tsx scripts/management-systems/build-oscal.ts csf <oscal-content>/nist.gov/CSF/v2.0/json
//
// Source: https://github.com/usnistgov/oscal-content (NIST publications are
// US Government works, not subject to copyright in the United States). The
// requirement text is copied from the catalogue, never written by hand.
// Output: lib/management-systems/catalogue/generated/<slug>.json.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Part = { id?: string; name: string; prose?: string; props?: Prop[]; parts?: Part[] };
type Prop = { name: string; value: string; class?: string };
type Param = { id: string; label?: string; select?: { "how-many"?: string; choice?: string[] } };
type Control = { id: string; class?: string; title: string; props?: Prop[]; params?: Param[]; parts?: Part[]; controls?: Control[] };
type Group = { id: string; title: string; parts?: Part[]; controls?: Control[] };
type Catalog = { metadata: { title: string; version: string; "last-modified": string }; groups: Group[] };

const [kind, dir] = process.argv.slice(2);
if (!kind || !dir) throw new Error("usage: build-oscal.ts <sp800-53|csf> <json dir>");

const sha = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const load = (file: string) => (JSON.parse(readFileSync(file, "utf8")) as { catalog: Catalog }).catalog;
const label = (c: { props?: Prop[] }) => c.props?.find((p) => p.name === "label" && !p.class)?.value;
const withdrawn = (c: Control) => c.props?.some((p) => p.name === "status" && p.value === "withdrawn") ?? false;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

type Req = { code: string; title: string; parent?: string; officialText?: string; examples?: string[]; tags?: string[] };

function write(slug: string, source: object, requirements: Req[]) {
  const out = join("lib/management-systems/catalogue/generated", `${slug}.json`);
  writeFileSync(out, JSON.stringify({ source, requirements }, null, 0) + "\n");
  console.log(`${out}: ${requirements.length} requirements`);
}

if (kind === "sp800-53") {
  const file = join(dir, "NIST_SP-800-53_rev5_catalog.json");
  const catalog = load(file);
  // Baseline membership from NIST's resolved baseline profiles.
  const baselines: Record<string, Set<string>> = {};
  for (const b of ["LOW", "MODERATE", "HIGH", "PRIVACY"]) {
    const ids = new Set<string>();
    const walk = (cs: Control[] = []) => cs.forEach((c) => (ids.add(c.id), walk(c.controls)));
    load(join(dir, `NIST_SP-800-53_rev5_${b}-baseline-resolved-profile_catalog.json`)).groups.forEach((g) => walk(g.controls));
    baselines[b.toLowerCase()] = ids;
  }

  const params = new Map<string, Param>();
  const indexParams = (cs: Control[] = []) => cs.forEach((c) => (c.params?.forEach((p) => params.set(p.id, p)), indexParams(c.controls)));
  catalog.groups.forEach((g) => indexParams(g.controls));

  // NIST's own convention for organisation-defined parameters.
  const insert = (prose: string): string =>
    prose.replace(/\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g, (_, id: string) => {
      const p = params.get(id);
      if (!p) return "[Assignment: organization-defined value]";
      if (p.select?.choice?.length) {
        const how = p.select["how-many"] === "one-or-more" ? "Selection (one or more): " : "Selection: ";
        return `[${how}${p.select.choice.map(insert).join("; ")}]`;
      }
      return `[Assignment: ${p.label ?? "organization-defined value"}]`;
    });

  const render = (part: Part, depth = 0): string[] => {
    const lbl = label(part);
    const own = part.prose ? [`${"  ".repeat(depth)}${lbl ? `${lbl} ` : ""}${insert(clean(part.prose))}`] : [];
    return [...own, ...(part.parts ?? []).filter((p) => p.name === "item").flatMap((p) => render(p, part.prose ? depth + 1 : depth))];
  };
  const statement = (c: Control) => {
    const s = c.parts?.find((p) => p.name === "statement");
    return s ? render(s).join("\n") : undefined;
  };
  const tags = (id: string) => Object.entries(baselines).flatMap(([b, ids]) => (ids.has(id) ? [`baseline:${b}`] : []));

  const requirements: Req[] = [];
  for (const g of catalog.groups) {
    const family = g.id.toUpperCase();
    requirements.push({ code: family, title: g.title });
    for (const c of g.controls ?? []) {
      if (withdrawn(c)) continue;
      requirements.push({ code: label(c) ?? c.id.toUpperCase(), title: c.title, parent: family, officialText: statement(c), tags: tags(c.id) });
      for (const e of c.controls ?? []) {
        if (withdrawn(e)) continue;
        requirements.push({ code: label(e) ?? e.id.toUpperCase(), title: `${c.title} | ${e.title}`, parent: family, officialText: statement(e), tags: tags(e.id) });
      }
    }
  }
  write("nist-sp-800-53-r5", { title: catalog.metadata.title, version: catalog.metadata.version, lastModified: catalog.metadata["last-modified"], file: "NIST_SP-800-53_rev5_catalog.json", sha256: sha(file) }, requirements);
} else if (kind === "csf") {
  const file = join(dir, "NIST_CSF_v2.0_catalog.json");
  const catalog = load(file);
  const prose = (parts: Part[] | undefined, name: string) => parts?.filter((p) => p.name === name && p.prose).map((p) => clean(p.prose!)) ?? [];
  const requirements: Req[] = [];
  for (const fn of catalog.groups) {
    const fnTitle = fn.title.charAt(0) + fn.title.slice(1).toLowerCase();
    requirements.push({ code: fn.id, title: `${fnTitle}: ${prose(fn.parts, "statement")[0] ?? ""}`.replace(/: $/, "") });
    for (const cat of fn.controls ?? []) {
      // CSF 1.1 categories withdrawn in 2.0 remain in the catalogue with only withdrawn subcategories.
      const subs = (cat.controls ?? []).filter((sub) => !withdrawn(sub) && prose(sub.parts, "statement").length > 0);
      if (withdrawn(cat) || subs.length === 0) continue;
      requirements.push({ code: cat.id, title: cat.title, parent: fn.id });
      for (const sub of subs) {
        const text = prose(sub.parts, "statement")[0];
        requirements.push({ code: sub.id, title: text, parent: cat.id, officialText: text, examples: prose(sub.parts, "example") });
      }
    }
  }
  write("nist-csf-2-0", { title: catalog.metadata.title, version: catalog.metadata.version, lastModified: catalog.metadata["last-modified"], file: "NIST_CSF_v2.0_catalog.json", sha256: sha(file) }, requirements);
} else {
  throw new Error(`unknown kind ${kind}`);
}
