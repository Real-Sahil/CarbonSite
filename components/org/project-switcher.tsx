"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";

/**
 * Picks the project the person is working in. The choice is a cookie checked
 * on the server; the dashboard opens on it, and the pages that do not follow it
 * yet (everything but the dashboard) still show the whole organisation.
 */
export function ProjectSwitcher({ orgId, projects, selectedId }: { orgId: string; projects: { id: string; name: string }[]; selectedId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(selectedId ?? "");
  const [busy, setBusy] = useState(false);
  if (projects.length === 0) return null;

  async function change(next: string) {
    setValue(next);
    setBusy(true);
    const res = await fetch(`/api/orgs/${orgId}/selected-project`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: next || null }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setValue(selectedId ?? "");
    if (pathname === `/orgs/${orgId}/dashboard`) router.replace(next ? `${pathname}?projectId=${encodeURIComponent(next)}` : pathname);
    else router.refresh();
  }

  return (
    <div className="border-b border-slate-200 px-4 py-2.5">
      <label htmlFor="project-switcher" className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
        <FolderKanban className="h-3.5 w-3.5" aria-hidden /> Project
      </label>
      <select
        id="project-switcher"
        value={value}
        disabled={busy}
        onChange={(e) => void change(e.target.value)}
        className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
      >
        <option value="">All projects</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );
}
