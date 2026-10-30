"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDisclosure, FormError } from "@/components/forms/form-kit";
import type { LayoutBlockDef, ResolvedBlock } from "@/lib/reports/layout";

type Loaded = { catalogue: LayoutBlockDef[]; blocks: ResolvedBlock[] };

const inputClass =
  "h-8 w-full rounded-[8px] border border-[#E3E8EE] bg-white px-2 text-sm placeholder:text-[#5B6A78] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2400c]/40";

/** Reorder, hide and rename the sections of a report. Figures never change, only what prints and where. */
export function ReportLayoutEditor({ orgId, reportType }: { orgId: string; reportType: string }) {
  const url = `/api/orgs/${orgId}/report-layouts/${reportType}`;
  const [data, setData] = useState<Loaded | null>(null);
  const [blocks, setBlocks] = useState<ResolvedBlock[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Could not load the layout.");
        return (await res.json()) as Loaded;
      })
      .then((loaded) => {
        if (!live) return;
        setData(loaded);
        setBlocks(loaded.blocks);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [url]);

  if (!data) {
    return error ? <FormError>{error}</FormError> : <Loader2 className="h-4 w-4 animate-spin text-[#5B6A78]" aria-label="Loading layout" />;
  }

  const def = (id: string) => data.catalogue.find((b) => b.id === id);
  const patch = (id: string, change: Partial<ResolvedBlock>) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...change } : b)));

  // Only body ("flow") blocks move; each step swaps with the next body block so pinned ones stay put.
  function move(id: string, dir: -1 | 1) {
    const flow = blocks.filter((b) => def(b.id)?.position === "flow");
    const at = flow.findIndex((b) => b.id === id);
    const other = flow[at + dir];
    if (!other) return;
    const next = [...blocks];
    const i = next.findIndex((b) => b.id === id);
    const j = next.findIndex((b) => b.id === other.id);
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  }

  async function run(method: "PUT" | "DELETE") {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PUT" ? JSON.stringify({ blocks: blocks.map(({ id, hidden, title }) => ({ id, ...(hidden ? { hidden } : {}), ...(title ? { title } : {}) })) }) : undefined,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? "Could not save the layout.");
      if (method === "DELETE") {
        const fresh = await (await fetch(url)).json();
        setBlocks(fresh.blocks);
        setNote("Back to the standard layout.");
      } else {
        setBlocks(body.blocks);
        setNote("Saved. New reports use this layout.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the layout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDisclosure title="Report layout">
      <div className="col-span-full space-y-3">
        <p className="text-sm text-[#41505F]">
          Choose which sections print, their order and their headings. Figures come from the snapshot and never change. Applies to new GHG Protocol reports.
        </p>
        <ul className="divide-y divide-[#E3E8EE] rounded-md border border-[#E3E8EE] bg-white">
          {blocks.map((b) => {
            const d = def(b.id);
            if (!d) return null;
            const movable = d.position === "flow";
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className={`min-w-40 flex-1 text-sm ${b.hidden ? "text-[#5B6A78] line-through" : "text-[#131d29]"}`}>{d.label}</span>
                {d.defaultTitle && (
                  <input
                    type="text"
                    maxLength={120}
                    value={b.title ?? ""}
                    placeholder={d.defaultTitle}
                    aria-label={`Heading for ${d.label}`}
                    onChange={(e) => patch(b.id, { title: e.target.value || undefined })}
                    className={`${inputClass} sm:w-64`}
                  />
                )}
                {movable && (
                  <>
                    <Button type="button" variant="ghost" size="sm" aria-label={`Move ${d.label} up`} onClick={() => move(b.id, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" aria-label={`Move ${d.label} down`} onClick={() => move(b.id, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {d.required ? (
                  <span className="w-20 text-right text-xs text-[#5B6A78]">Always shown</span>
                ) : (
                  <Button type="button" variant="ghost" size="sm" aria-pressed={!b.hidden} aria-label={`${b.hidden ? "Show" : "Hide"} ${d.label}`} onClick={() => patch(b.id, { hidden: !b.hidden })}>
                    {b.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {error && <FormError>{error}</FormError>}
        {note && <p className="text-sm text-[#41505F]" role="status">{note}</p>}
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => run("PUT")}>
            Save layout
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => run("DELETE")}>
            Reset to standard
          </Button>
        </div>
      </div>
    </FormDisclosure>
  );
}
