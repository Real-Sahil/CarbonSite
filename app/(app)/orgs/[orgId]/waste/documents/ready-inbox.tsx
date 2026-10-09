"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export type ReadyItem = { id: string; title: string; carrier: string | null; reference: string | null; tonnes: number; ewc: string | null; date: string; route: string; facility: string };

/** Transfer notes that were read, checked on the register and match what this carrier did before. One click each, or all at once. */
export function ReadyInbox({ orgId, items }: { orgId: string; items: ReadyItem[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set(items.map((i) => i.id)));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  async function approve() {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/orgs/${orgId}/waste/documents/bulk-accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...picked] }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setNote(d?.message ?? "Could not approve those loads."); return; }
    setNote(d.skipped.length ? `${d.recorded} recorded. ${d.skipped.length} need a look first.` : `${d.recorded} recorded.`);
    router.refresh();
  }
  return (
    <section aria-labelledby="ready-h" className="mb-6 rounded-xl border border-green-200 bg-green-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="ready-h" className="text-sm font-semibold text-gray-900">Ready to approve ({items.length})</h2>
          <p className="text-xs text-gray-600">Read from the file, carrier found on the Environment Agency register, and the same facility and route as this carrier's earlier loads. Check the figures, then approve.</p>
        </div>
        <Button type="button" disabled={busy || picked.size === 0} onClick={() => void approve()}>{busy ? "Recording…" : `Approve ${picked.size} selected`}</Button>
      </div>
      <ul className="mt-3 divide-y divide-green-100 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex items-start gap-3 py-2">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={picked.has(i.id)} onChange={() => toggle(i.id)} aria-label={`Select ${i.title}`} />
            <div className="min-w-0">
              <div className="font-medium text-gray-900">{i.carrier ?? i.title} <span className="font-normal text-gray-500">· {i.reference}</span></div>
              <div className="text-xs text-gray-600">{i.tonnes} t · EWC {i.ewc} · {i.date} · {i.route} · {i.facility}</div>
            </div>
          </li>
        ))}
      </ul>
      {note && <p role="status" className="mt-2 text-xs text-gray-700">{note}</p>}
    </section>
  );
}
