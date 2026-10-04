// Scope -> category -> site flows for the Sankey, built from slice rows.
// Each calculation sits in exactly one slice row, so every level of the diagram
// sums to the same total as the dashboard headline (a test holds that).

export type FlowRow = { scope: number; emissionCategoryId: string; facilityId: string | null; totalCo2e: unknown };

export type FlowNode = { id: string; label: string; kind: "scope" | "category" | "site"; scope?: number };
export type FlowLink = { source: string; target: string; value: number };
export type Flows = { nodes: FlowNode[]; links: FlowLink[]; totalKg: number };

export const OTHER_CATEGORIES = "category:other";
export const OTHER_SITES = "site:other";
export const NO_SITE = "site:none";

const MAX_CATEGORIES = 8;
const MAX_SITES = 6;

export function buildFlows(
  rows: FlowRow[],
  names: { category: (id: string) => string; facility: (id: string) => string },
  limits: { categories?: number; sites?: number } = {},
): Flows {
  const maxCategories = limits.categories ?? MAX_CATEGORIES;
  const maxSites = limits.sites ?? MAX_SITES;
  const clean = rows.map((r) => ({ ...r, kg: Number(r.totalCo2e) })).filter((r) => Number.isFinite(r.kg) && r.kg > 0);
  const totalKg = clean.reduce((s, r) => s + r.kg, 0);

  const byCategory = new Map<string, { scope: number; kg: number }>();
  const bySite = new Map<string, number>();
  for (const r of clean) {
    const c = byCategory.get(r.emissionCategoryId) ?? { scope: r.scope, kg: 0 };
    c.kg += r.kg;
    byCategory.set(r.emissionCategoryId, c);
    const site = r.facilityId ?? NO_SITE;
    bySite.set(site, (bySite.get(site) ?? 0) + r.kg);
  }
  const keepCategory = new Set([...byCategory].sort((a, b) => b[1].kg - a[1].kg).slice(0, maxCategories).map(([id]) => id));
  const keepSite = new Set([...bySite].filter(([id]) => id !== NO_SITE).sort((a, b) => b[1] - a[1]).slice(0, maxSites).map(([id]) => id));

  const catNode = (id: string, scope: number) => (keepCategory.has(id) ? `category:${id}` : `${OTHER_CATEGORIES}:${scope}`);
  const siteNode = (id: string | null) => (id === null ? NO_SITE : keepSite.has(id) ? `site:${id}` : OTHER_SITES);

  const scopeToCat = new Map<string, number>();
  const catToSite = new Map<string, number>();
  const add = (m: Map<string, number>, key: string, v: number) => m.set(key, (m.get(key) ?? 0) + v);
  for (const r of clean) {
    const c = catNode(r.emissionCategoryId, r.scope);
    add(scopeToCat, `scope:${r.scope}|${c}`, r.kg);
    add(catToSite, `${c}|${siteNode(r.facilityId)}`, r.kg);
  }

  const links: FlowLink[] = [];
  for (const [k, value] of scopeToCat) { const [source, target] = k.split("|"); links.push({ source, target, value }); }
  for (const [k, value] of catToSite) { const [source, target] = k.split("|"); links.push({ source, target, value }); }

  const used = new Set(links.flatMap((l) => [l.source, l.target]));
  const nodes: FlowNode[] = [];
  for (const scope of [1, 2, 3]) if (used.has(`scope:${scope}`)) nodes.push({ id: `scope:${scope}`, label: `Scope ${scope}`, kind: "scope", scope });
  for (const id of used) {
    if (id.startsWith("category:other:")) {
      const scope = Number(id.slice("category:other:".length));
      nodes.push({ id, label: `Other Scope ${scope} categories`, kind: "category", scope });
    } else if (id.startsWith("category:")) {
      nodes.push({ id, label: names.category(id.slice("category:".length)), kind: "category", scope: byCategory.get(id.slice("category:".length))?.scope });
    }
  }
  for (const id of used) {
    if (id === OTHER_SITES) nodes.push({ id, label: "Other sites", kind: "site" });
    else if (id === NO_SITE) nodes.push({ id, label: "No site recorded", kind: "site" });
    else if (id.startsWith("site:")) nodes.push({ id, label: names.facility(id.slice("site:".length)), kind: "site" });
  }
  return { nodes, links, totalKg };
}
