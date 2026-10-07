// The dashboard's widget registry and layout rules (pure). A layout is only
// ids, order, widths and hidden ids: it never carries data, so every figure is
// read at request time under the viewer's own role. A widget the role may not
// see is never offered, never laid out and never rendered.

import { z } from "zod";

export type WidgetWidth = "half" | "full";
export type WidgetDef = { id: string; title: string; width: WidgetWidth; roles?: readonly string[] };

const EDITORS = ["admin", "editor", "sustainability_director", "sustainability_manager", "operations_manager"] as const;

/** Every widget, in the order the dashboard has always shown them. */
export const WIDGETS: readonly WidgetDef[] = [
  { id: "headline", title: "Footprint and key figures", width: "full" },
  { id: "live", title: "Live dashboard", width: "full" },
  { id: "industry", title: "Industry insights", width: "full" },
  { id: "environment", title: "Water and waste", width: "full" },
  { id: "operations", title: "Operations at a glance", width: "full" },
  { id: "waste-kpis", title: "Waste KPIs", width: "half" },
  { id: "scope-breakdown", title: "Scope breakdown, categories and trend", width: "full" },
  { id: "flow", title: "Emissions flow", width: "half" },
  { id: "waterfall", title: "Change since the previous period", width: "half" },
  { id: "facilities", title: "By facility", width: "full" },
  { id: "scope-detail", title: "Scopes, year-on-year and readiness", width: "full" },
  { id: "data-quality", title: "Data quality", width: "full" },
  { id: "analytics-reporting", title: "Analytics and reporting", width: "full" },
  { id: "social-evidence", title: "Social value and evidence", width: "full" },
  { id: "ops-health", title: "Operations health", width: "half" },
  { id: "review-queue", title: "Review task queue", width: "half" },
  { id: "run-calculation", title: "Run a calculation", width: "half", roles: EDITORS },
  { id: "quick-links", title: "Quick links", width: "full" },
];

export const WIDGET_IDS = WIDGETS.map((w) => w.id);
const known = new Set(WIDGET_IDS);

/** Widgets a role may be given at all. */
export const widgetsForRole = (role: string): WidgetDef[] => WIDGETS.filter((w) => !w.roles || w.roles.includes(role));

export type Layout = { order: string[]; hidden: string[]; widths: Record<string, WidgetWidth> };

export const layoutSchema = z.object({
  order: z.array(z.string()).max(40),
  hidden: z.array(z.string()).max(40),
  widths: z.record(z.string(), z.enum(["half", "full"])),
});

/** Why a layout is refused: any id the registry does not know. */
export function layoutError(l: Layout): string | null {
  const bad = [...l.order, ...l.hidden, ...Object.keys(l.widths)].find((id) => !known.has(id));
  return bad ? `"${bad}" is not a dashboard widget.` : null;
}

// What each kind of person sees first. Everything else stays one click away
// under "Add widget"; nothing is withheld that the role may read.
const EXECUTIVE = ["headline", "scope-breakdown", "flow", "waterfall", "facilities", "data-quality", "scope-detail"];
const REVIEWER = ["headline", "review-queue", "ops-health", "data-quality", "operations", "flow"];
const PRESETS: Record<string, string[] | undefined> = {
  sustainability_director: EXECUTIVE,
  viewer: EXECUTIVE,
  auditor: EXECUTIVE,
  verifier: EXECUTIVE,
  reviewer: REVIEWER,
};

/** The default layout for a role: the preset's widgets first, the rest hidden. */
export function presetLayout(role: string): Layout {
  const preset = PRESETS[role];
  const all = widgetsForRole(role).map((w) => w.id);
  if (!preset) return { order: all, hidden: [], widths: {} };
  const shown = preset.filter((id) => all.includes(id));
  return { order: [...shown, ...all.filter((id) => !shown.includes(id))], hidden: all.filter((id) => !shown.includes(id)), widths: {} };
}

export type PlacedWidget = { id: string; title: string; width: WidgetWidth; hidden: boolean };

/**
 * The widgets to lay out: the saved layout (the person's, else the
 * organisation's, else the role's preset) limited to widgets available now.
 * A widget missing from a saved layout (added to the product since) is placed
 * last and shown; one the role may not have, or with nothing to show, drops out.
 */
export function resolveLayout(available: WidgetDef[], saved: Layout | null, role: string): PlacedWidget[] {
  const base = saved ?? presetLayout(role);
  const byId = new Map(available.map((w) => [w.id, w]));
  const ids = [...new Set([...base.order, ...available.map((w) => w.id)])].filter((id) => byId.has(id));
  const hidden = new Set(base.hidden);
  return ids.map((id) => {
    const w = byId.get(id)!;
    return { id, title: w.title, width: base.widths[id] ?? w.width, hidden: hidden.has(id) };
  });
}

/** What to store from an arrangement on screen. */
export function toLayout(items: PlacedWidget[]): Layout {
  return {
    order: items.map((i) => i.id),
    hidden: items.filter((i) => i.hidden).map((i) => i.id),
    widths: Object.fromEntries(items.map((i) => [i.id, i.width])),
  };
}
