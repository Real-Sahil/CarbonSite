// Period change by emission category as a waterfall: previous total, the
// largest movers, everything else together, current total. The steps always add
// up: previous + sum of changes = current (a test holds that).

export type CategoryTotal = { id: string; label: string; kg: number };
export type WaterfallStep = { id: string; label: string; kind: "total" | "change"; value: number; from: number; to: number };

export function buildWaterfall(
  previous: CategoryTotal[],
  current: CategoryTotal[],
  labels: { previous: string; current: string },
  topN = 6,
): WaterfallStep[] {
  const prev = new Map(previous.map((c) => [c.id, c]));
  const curr = new Map(current.map((c) => [c.id, c]));
  const deltas = [...new Set([...prev.keys(), ...curr.keys()])]
    .map((id) => ({ id, label: (curr.get(id) ?? prev.get(id))!.label, delta: (curr.get(id)?.kg ?? 0) - (prev.get(id)?.kg ?? 0) }))
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const movers = deltas.slice(0, topN);
  const rest = deltas.slice(topN).reduce((s, d) => s + d.delta, 0);

  const start = previous.reduce((s, c) => s + c.kg, 0);
  const steps: WaterfallStep[] = [{ id: "start", label: labels.previous, kind: "total", value: start, from: 0, to: start }];
  let running = start;
  const push = (id: string, label: string, delta: number) => {
    steps.push({ id, label, kind: "change", value: delta, from: running, to: running + delta });
    running += delta;
  };
  for (const m of movers) push(m.id, m.label, m.delta);
  if (deltas.length > topN && rest !== 0) push("other", "All other categories", rest);
  const end = current.reduce((s, c) => s + c.kg, 0);
  steps.push({ id: "end", label: labels.current, kind: "total", value: end, from: 0, to: end });
  return steps;
}
