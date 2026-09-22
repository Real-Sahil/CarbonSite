"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { handleSupabaseError } from "@/lib/utils/supabase-error-handler";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "reviewer", label: "Reviewer" },
  { value: "viewer", label: "Viewer" },
  { value: "auditor", label: "Auditor" },
  { value: "field_worker", label: "Field Worker" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  reviewer: "Reviewer",
  viewer: "Viewer",
  auditor: "Auditor",
  field_worker: "Field Worker",
};

const ROLE_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  editor: "secondary",
  reviewer: "secondary",
  viewer: "outline",
  auditor: "outline",
  field_worker: "outline",
};

interface MemberData {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: string;
}

interface MemberCardsProps {
  orgId: string;
  members: MemberData[];
  currentUserId: string;
}

interface StatusError extends Error { status?: number; }

export function MemberCards({ orgId, members, currentUserId }: MemberCardsProps) {
  const router = useRouter();
  const [roleFilter, setRoleFilter] = useState("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Per-card role draft state
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>(
    Object.fromEntries(members.map((m) => [m.id, m.role])),
  );
  const [, startTransition] = useTransition();

  const uniqueRoles = [...new Set(members.map((m) => m.role))].sort();
  const filtered =
    roleFilter === "all" ? members : members.filter((m) => m.role === roleFilter);

  function setError(id: string, msg: string) {
    setErrors((prev) => ({ ...prev, [id]: msg }));
  }
  function clearError(id: string) {
    setErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  function updateRole(m: MemberData) {
    const newRole = roleDrafts[m.id];
    if (!newRole || newRole === m.role) return;
    clearError(m.id);
    setPendingId(m.id);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/members/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      setPendingId(null);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = new Error(body?.message ?? "Could not update role");
        (err as StatusError).status = res.status;
        const { action, message } = handleSupabaseError(err);
        if (action === "logout") { localStorage.removeItem("session"); router.push("/auth/sign-in"); return; }
        setError(m.id, message);
        return;
      }
      router.refresh();
    });
  }

  function removeMember(m: MemberData) {
    if (!window.confirm(`Remove ${m.name ?? m.email} from this organisation?`)) return;
    clearError(m.id);
    setPendingId(m.id);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/members/${m.id}`, { method: "DELETE" });
      setPendingId(null);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = new Error(body?.message ?? "Could not remove member");
        (err as StatusError).status = res.status;
        const { action, message } = handleSupabaseError(err);
        if (action === "logout") { localStorage.removeItem("session"); router.push("/auth/sign-in"); return; }
        setError(m.id, message);
        return;
      }
      router.refresh();
    });
  }

  function deleteAccount(m: MemberData) {
    if (!window.confirm(
      `Permanently delete the account for ${m.name ?? m.email} (${m.email})?\n\nThis cannot be undone.`,
    )) return;
    clearError(m.id);
    setPendingId(m.id);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/members/${m.id}?deleteAccount=true`, { method: "DELETE" });
      setPendingId(null);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = new Error(body?.message ?? "Could not delete account");
        (err as StatusError).status = res.status;
        const { action, message } = handleSupabaseError(err);
        if (action === "logout") { localStorage.removeItem("session"); router.push("/auth/sign-in"); return; }
        setError(m.id, message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Role filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setRoleFilter("all")}
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            roleFilter === "all"
              ? "bg-[#0F766E] text-white border-[#0F766E]"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
          }`}
        >
          All ({members.length})
        </button>
        {uniqueRoles.map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              roleFilter === r
                ? "bg-[#0F766E] text-white border-[#0F766E]"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {ROLE_LABELS[r] ?? r} ({members.filter((m) => m.role === r).length})
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No members match this filter.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => {
            const isPending = pendingId === m.id;
            const isCurrentUser = m.userId === currentUserId;
            const draft = roleDrafts[m.id] ?? m.role;
            const roleChanged = draft !== m.role;
            const initial = (m.name ?? m.email)[0]?.toUpperCase() ?? "?";

            return (
              <div
                key={m.id}
                className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3 min-w-0"
              >
                {/* Avatar + identity */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-[#CCFBF1] flex items-center justify-center text-[#0F766E] text-sm font-semibold shrink-0 select-none">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {m.name ?? <em className="text-slate-400 font-normal">No name</em>}
                      </p>
                      {isCurrentUser && (
                        <span className="text-[10px] text-slate-400 shrink-0">(you)</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{m.email}</p>
                    <div className="mt-1.5">
                      <Badge variant={ROLE_BADGE[m.role] ?? "outline"} className="text-[10px] px-1.5 py-0">
                        {ROLE_LABELS[m.role] ?? m.role}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Role edit + actions */}
                <div className="flex items-center gap-1.5 pt-2.5 border-t border-slate-100">
                  <select
                    value={draft}
                    disabled={isPending}
                    aria-label={`Role for ${m.name ?? m.email}`}
                    onChange={(e) => setRoleDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    className="flex-1 min-w-0 h-8 rounded-md border border-slate-200 bg-white px-2 text-xs shadow-sm disabled:opacity-50"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    title="Save role"
                    disabled={isPending || !roleChanged}
                    onClick={() => updateRole(m)}
                    className="h-8 w-8 shrink-0"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    title="Remove member"
                    disabled={isPending}
                    onClick={() => removeMember(m)}
                    className="h-8 w-8 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  {!isCurrentUser && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      title="Delete user account"
                      disabled={isPending}
                      onClick={() => deleteAccount(m)}
                      className="h-8 w-8 shrink-0 text-red-600 hover:text-red-700 hover:border-red-300"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {errors[m.id] && (
                  <p className="text-xs text-red-600">{errors[m.id]}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
