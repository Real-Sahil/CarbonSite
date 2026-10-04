"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormActions, FormError, FormSection, fieldClass } from "@/components/forms/form-kit";

export function CreateProjectForm({
  orgId,
  contractId,
}: {
  orgId: string;
  contractId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const body = {
      name: data.get("name") as string,
      projectCode: (data.get("projectCode") as string) || undefined,
      status: data.get("status") as string,
      postcode: (data.get("postcode") as string) || undefined,
      startDate: (data.get("startDate") as string) || undefined,
      endDate: (data.get("endDate") as string) || undefined,
    };
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/contracts/${contractId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.message ?? "Could not create project");
        return;
      }
      form.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-[#E5E7EB] bg-white p-4 sm:p-5">
      <FormSection title="New project" cols={3}>
          <FormField label="Name" span={4} htmlFor="project-name">
            <Input id="project-name" name="name" required placeholder="Project name" />
          </FormField>
          <FormField label="Project code" htmlFor="project-code" optional>
            <Input id="project-code" name="projectCode" placeholder="PRJ-001" />
          </FormField>
          <FormField label="Status" htmlFor="project-status" optional>
            <select
              id="project-status"
              name="status"
              defaultValue="active"
              className={fieldClass}
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On hold</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </FormField>
          <FormField label="Postcode" htmlFor="project-postcode" optional>
            <Input id="project-postcode" name="postcode" placeholder="e.g. SW1A 2AA" />
          </FormField>
          <FormField label="Start date" htmlFor="project-start" optional>
            <Input id="project-start" name="startDate" type="date" />
          </FormField>
          <FormField label="End date" htmlFor="project-end" optional>
            <Input id="project-end" name="endDate" type="date" />
          </FormField>
        </FormSection>
      <FormError>{error}</FormError>
      <FormActions>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Creating…" : "Create project"}
        </Button>
      </FormActions>
    </form>
  );
}

export function DeleteProjectButton({
  orgId,
  contractId,
  projectId,
  name,
}: {
  orgId: string;
  contractId: string;
  projectId: string;
  name: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/contracts/${contractId}/projects/${projectId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.message ?? "Could not delete project");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="icon"
        variant="outline"
        disabled={isPending}
        title="Delete project"
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
