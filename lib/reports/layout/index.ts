// Per-organisation report layouts: which blocks a report shows, in what order, under what heading.
// Pure (no database or request imports) so the template, the API and the tests share one definition.
// A layout never touches a figure: blocks only choose which already-built section is printed, so a
// report's totals still come from the same snapshot as the dashboard's.
import { z } from "zod";

export type LayoutBlockDef = {
  id: string;
  label: string;
  /** "flow" blocks can be moved; "top" and "bottom" blocks keep their place. */
  position: "top" | "flow" | "bottom";
  /** A required block is always printed (identity, caveats and attribution cannot be hidden). */
  required: boolean;
  /** Section heading that can be renamed; absent when the block has no heading of its own. */
  defaultTitle?: string;
};

export const GHG_PROTOCOL_BLOCKS: readonly LayoutBlockDef[] = [
  { id: "header", label: "Title block", position: "top", required: true },
  { id: "kpis", label: "Headline figures", position: "top", required: false },
  { id: "progress", label: "Progress against baseline", position: "flow", required: false },
  { id: "summary", label: "Summary", position: "flow", required: false, defaultTitle: "Summary" },
  { id: "scope_proportions", label: "Scope proportions", position: "flow", required: false, defaultTitle: "Scope Proportions" },
  { id: "scope1", label: "Scope 1 detail", position: "flow", required: false, defaultTitle: "Scope 1 — Direct Emissions" },
  { id: "scope2", label: "Scope 2 detail", position: "flow", required: false, defaultTitle: "Scope 2 — Indirect Energy Emissions" },
  { id: "scope3", label: "Scope 3 detail", position: "flow", required: false, defaultTitle: "Scope 3 — Value Chain Emissions" },
  { id: "gas_breakdown", label: "Per-gas breakdown", position: "flow", required: false, defaultTitle: "Per-Gas Breakdown (GWP AR6)" },
  { id: "evidence", label: "Evidence behind the figures", position: "flow", required: false, defaultTitle: "Evidence Behind These Figures" },
  { id: "assurance_note", label: "Assurance and limitations", position: "flow", required: true },
  { id: "footer", label: "Footer", position: "bottom", required: true },
];

/** Report types that accept a layout, with their block catalogue. */
export const LAYOUT_CATALOGUE: Record<string, readonly LayoutBlockDef[]> = {
  ghg_protocol: GHG_PROTOCOL_BLOCKS,
};

export const MAX_TITLE_LENGTH = 120;

export const layoutBlockSchema = z.object({
  id: z.string().min(1).max(64),
  hidden: z.boolean().optional(),
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
});

export const layoutSchema = z.object({
  blocks: z.array(layoutBlockSchema).max(64),
});

export type LayoutInput = z.infer<typeof layoutSchema>;

export type ResolvedBlock = { id: string; hidden: boolean; title?: string };

/**
 * Turns a saved layout (or none) into the full list of blocks in print order. Unknown and repeated ids
 * are dropped, a required block is never hidden, a block the saved layout predates is slotted in after
 * its nearest default predecessor (or at the end of the body when none is placed), so the saved order
 * always wins, and titles are kept only for blocks that have a heading.
 */
export function normaliseLayout(reportType: string, input?: LayoutInput | null): ResolvedBlock[] {
  const catalogue = LAYOUT_CATALOGUE[reportType];
  if (!catalogue) return [];
  const byId = new Map(catalogue.map((b) => [b.id, b]));

  const flowDefaults = catalogue.filter((b) => b.position === "flow").map((b) => b.id);
  const seen = new Set<string>();
  const flow: string[] = [];
  const state = new Map<string, { hidden: boolean; title?: string }>();

  for (const entry of input?.blocks ?? []) {
    const def = byId.get(entry.id);
    if (!def || seen.has(entry.id)) continue;
    seen.add(entry.id);
    state.set(entry.id, {
      hidden: def.required ? false : entry.hidden === true,
      title: def.defaultTitle ? entry.title : undefined,
    });
    if (def.position === "flow") flow.push(entry.id);
  }

  for (let i = 0; i < flowDefaults.length; i++) {
    const id = flowDefaults[i];
    if (flow.includes(id)) continue;
    const before = flowDefaults.slice(0, i).reverse().find((p) => flow.includes(p));
    if (before) flow.splice(flow.indexOf(before) + 1, 0, id);
    else flow.push(id);
  }

  const resolve = (id: string): ResolvedBlock => {
    const s = state.get(id);
    return { id, hidden: s?.hidden ?? false, title: s?.title };
  };
  return [
    ...catalogue.filter((b) => b.position === "top").map((b) => resolve(b.id)),
    ...flow.map(resolve),
    ...catalogue.filter((b) => b.position === "bottom").map((b) => resolve(b.id)),
  ];
}

/** The layout every organisation gets until it saves one: catalogue order, nothing hidden. */
export function defaultLayout(reportType: string): LayoutInput {
  return { blocks: normaliseLayout(reportType).map(({ id }) => ({ id })) };
}

/** Where a block sits on the page: pinned to the top, free in the body, or pinned to the bottom. */
export function blockPosition(reportType: string, id: string): LayoutBlockDef["position"] {
  return LAYOUT_CATALOGUE[reportType]?.find((b) => b.id === id)?.position ?? "flow";
}
