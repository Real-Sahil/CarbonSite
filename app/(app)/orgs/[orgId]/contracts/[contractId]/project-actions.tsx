"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-kit";

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
    <form onSubmit={handleSubmit} className="rounded-[14px] border border-[#E5E7EB] p-[21px] flex flex-col gap-4">
      <p className="text-sm font-normal text-[#111827] tracking-[-0.42px]">New project</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField label="Name" htmlFor="project-name">
          <Input id="project-name" name="name" required placeholder="Project name" className="h-9 text-sm" />
        </FormField>
        <FormField label="Project code" htmlFor="project-code" optional>
          <Input id="project-code" name="projectCode" placeholder="PRJ-001" className="h-9 text-sm" />
        </FormField>
        <FormField label="Status" htmlFor="project-status" optional>
          <select
            id="project-status"
            name="status"
            defaultValue="active"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On hold</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </FormField>
        <FormField label="Postcode" htmlFor="project-postcode" optional>
          <Input id="project-postcode" name="postcode" placeholder="e.g. SW1A 2AA" className="h-9 text-sm" />
        </FormField>
        <FormField label="Start date" htmlFor="project-start" optional>
          <Input id="project-start" name="startDate" type="date" className="h-9 text-sm" />
        </FormField>
        <FormField label="End date" htmlFor="project-end" optional>
          <Input id="project-end" name="endDate" type="date" className="h-9 text-sm" />
        </FormField>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Creating…" : "Create project"}
        </Button>
      </div>
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
