"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { PALETTE_ITEMS, paletteMatches } from "@/lib/nav/palette-items";
import { SURFACE_KEYS } from "@/lib/saved-views";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

type SavedViewHit = { id: string; name: string; surface: string; href: string; shared: boolean };
export const OPEN_PALETTE_EVENT = "metricora:open-palette";

/**
 * Ctrl or Cmd+K: jump to a page, or open a saved view, by typing. Pages are a
 * fixed list filtered by role; saved views are fetched when it opens (the API
 * returns only the caller's own and the organisation's shared ones).
 */
export function CommandPalette({ orgId, role, canUseViews }: { orgId: string; role: string; canUseViews: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [views, setViews] = useState<SavedViewHit[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    if (!canUseViews) return;
    let cancelled = false;
    Promise.all(
      SURFACE_KEYS.map((s) =>
        fetch(`/api/orgs/${orgId}/saved-views?surface=${s}`)
          .then((r) => (r.ok ? r.json() : { views: [] }))
          .then((b) => (b.views ?? []) as SavedViewHit[])
          .catch(() => [] as SavedViewHit[]),
      ),
    ).then((all) => !cancelled && setViews(all.flat()));
    return () => { cancelled = true; };
  }, [open, orgId, canUseViews]);

  const results = useMemo(() => {
    const pages = paletteMatches(PALETTE_ITEMS, role, query).map((i) => ({ key: `p:${i.path}`, label: i.label, hint: "Page", href: `/orgs/${orgId}/${i.path}` }));
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const saved = views
      .filter((v) => words.every((w) => `${v.name} ${v.surface}`.toLowerCase().includes(w)))
      .map((v) => ({ key: `v:${v.id}`, label: v.name, hint: `${v.shared ? "Shared view" : "My view"} · ${v.surface}`, href: v.href }));
    return [...pages, ...saved].slice(0, 12);
  }, [query, role, views, orgId]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-[15%] z-50 w-[min(560px,92vw)] -translate-x-1/2 rounded-[14px] border border-[#E5E7EB] bg-white p-3 shadow-xl"
          onOpenAutoFocus={(e) => { e.preventDefault(); input.current?.focus(); }}
        >
          <Dialog.Title className="sr-only">Quick find</Dialog.Title>
          <Dialog.Description className="sr-only">Type to find a page or a saved view. Use the arrow keys and Enter.</Dialog.Description>
          <input
            ref={input}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              if (e.key === "Enter" && results[active]) go(results[active].href);
            }}
            placeholder="Find a page or a saved view"
            aria-label="Find a page or a saved view"
            role="combobox"
            aria-expanded
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `palette-${results[active].key}` : undefined}
            className="h-10 w-full rounded-[10px] border border-[#E5E7EB] px-3 text-sm outline-none focus:ring-2 focus:ring-amber-400/50"
          />
          <ul id="palette-results" role="listbox" className="mt-2 max-h-80 overflow-auto">
            {results.length === 0 ? <li className="px-3 py-6 text-center text-sm text-[#6B7280]">Nothing matches.</li> : null}
            {results.map((r, i) => (
              <li
                key={r.key}
                id={`palette-${r.key}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.href)}
                className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${i === active ? "bg-amber-50" : ""}`}
              >
                <span className="text-[#111827]">{r.label}</span>
                <span className="text-xs text-[#6B7280]">{r.hint}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-3 border-t border-[#E5E7EB] pt-2 text-xs text-[#6B7280]" aria-hidden="true">
            <span className="inline-flex items-center gap-1"><KbdGroup><Kbd>↑</Kbd><Kbd>↓</Kbd></KbdGroup> move</span>
            <span className="inline-flex items-center gap-1"><Kbd>Enter</Kbd> open</span>
            <span className="inline-flex items-center gap-1"><Kbd>Esc</Kbd> close</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
