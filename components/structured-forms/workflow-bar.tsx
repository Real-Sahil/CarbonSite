"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WORKFLOWS, isLockedStatus, type StructuredFormKey } from "@/lib/structured-forms/workflows";

const TONE_CLASSES = {
  neutral: "bg-gray-100 text-gray-700",
  active: "bg-blue-100 text-blue-800",
  warning: "bg-amber-100 text-amber-800",
  done: "bg-green-100 text-green-800",
  stopped: "bg-red-100 text-red-800",
} as const;

export function StatusBadge({ form, status }: { form: StructuredFormKey; status: string }) {
  const meta = WORKFLOWS[form].statuses[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[meta?.tone ?? "neutral"]}`}>
      {isLockedStatus(form, status) && <Lock className="h-3 w-3" aria-hidden="true" />}
      {meta?.label ?? status}
    </span>
  );
}

export function LockNotice({ form, status }: { form: StructuredFormKey; status: string }) {
  if (!isLockedStatus(form, status)) return null;
  const workflow = WORKFLOWS[form];
  const canRevise = workflow.revise?.from.includes(status);
  return (
    <div className="flex gap-2 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>
        This {workflow.noun} is {workflow.statuses[status]?.label.toLowerCase() ?? status} and read-only.
        {canRevise ? ` An admin can use "${workflow.revise?.label}" to make changes.` : ""}
      </span>
    </div>
  );
}

interface WorkflowBarProps {
  form: StructuredFormKey;
  orgId: string;
  id: string;
  status: string;
  canEdit: boolean;
  isAdmin: boolean;
  /** Flush unsaved content before the status moves on. */
  beforeChange?: () => Promise<void> | void;
}

export function WorkflowBar({ form, orgId, id, status, canEdit, isAdmin, beforeChange }: WorkflowBarProps) {
  const router = useRouter();
  const workflow = WORKFLOWS[form];
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextSteps = workflow.transitions[status] ?? [];
  const revise = workflow.revise && workflow.revise.from.includes(status) && isAdmin ? workflow.revise : null;

  if (!canEdit || (nextSteps.length === 0 && !revise)) return null;

  async function run(key: string, url: string, init: RequestInit) {
    setPending(key);
    setError(null);
    try {
      await beforeChange?.();
      const res = await fetch(url, init);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? "That change could not be saved. Try again.");
      }
      const data = (await res.json().catch(() => null)) as { id?: string } | null;
      if (data?.id && data.id !== id) {
        router.push(`/orgs/${orgId}/${form}/${data.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That change could not be saved. Try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Next step</p>
        <StatusBadge form={form} status={status} />
      </div>
      <div className="flex flex-wrap gap-2">
        {nextSteps.map((step) => (
          <Button
            key={step.to}
            type="button"
            size="sm"
            variant={workflow.lockStatuses.includes(step.to) ? "default" : "outline"}
            disabled={pending !== null}
            onClick={() =>
              run(step.to, workflow.statusUrl(orgId, id), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: step.to }),
              })
            }
          >
            {pending === step.to && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {step.label}
          </Button>
        ))}
        {revise && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => {
              if (!window.confirm(revise.confirm)) return;
              void run("revise", `/api/orgs/${orgId}/${form}/${id}/revise`, { method: "POST" });
            }}
          >
            {pending === "revise" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {revise.label}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="flex gap-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
