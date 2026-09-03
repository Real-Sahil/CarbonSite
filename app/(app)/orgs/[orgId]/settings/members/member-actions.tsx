"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { handleSupabaseError } from "@/lib/utils/supabase-error-handler";

interface StatusError extends Error { status?: number; }

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "reviewer", label: "Reviewer" },
  { value: "viewer", label: "Viewer" },
  { value: "auditor", label: "Auditor" },
  { value: "field_worker", label: "Field Worker" },
] as const;

export function MemberActions({
  orgId,
  memberId,
  memberName,
  currentRole,
  isCurrentUser,
}: {
  orgId: string;
  memberId: string;
  memberName: string;
  currentRole: string;
  isCurrentUser: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const roleChanged = role !== currentRole;

  function updateRole() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const error = new Error(body?.message ?? "Could not update member role");
        (error as StatusError).status = res.status;
        const { action, message } = handleSupabaseError(error);

        if (action === "logout") {
          localStorage.removeItem("session");
          router.push("/auth/sign-in");
          return;
        }

        setError(message);
        return;
      }

      router.refresh();
    });
  }

  function removeMember() {
    const confirmed = window.confirm(
      `Remove ${memberName} from this organisation? Their existing audit history will remain.`,
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/members/${memberId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const error = new Error(body?.message ?? "Could not remove member");
        (error as StatusError).status = res.status;
        const { action, message } = handleSupabaseError(error);

        if (action === "logout") {
          localStorage.removeItem("session");
          router.push("/auth/sign-in");
          return;
        }

        setError(message);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex min-w-64 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <select
          value={role}
          disabled={isPending}
          aria-label={`Role for ${memberName}`}
          onChange={(event) => setRole(event.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ROLES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="icon"
          variant="outline"
          title="Save role"
          disabled={isPending || !roleChanged}
          onClick={updateRole}
        >
          <Save className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          title={isCurrentUser ? "Remove yourself" : "Remove member"}
          disabled={isPending}
          onClick={removeMember}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
