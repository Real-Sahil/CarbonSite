"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-name" className="text-xs text-[#374151] tracking-[-0.36px]">
            Name <span aria-hidden="true" className="text-red-500">*</span>
          </Label>
          <Input id="project-name" name="name" required placeholder="Project name" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-code" className="text-xs text-[#374151] tracking-[-0.36px]">Project code</Label>
          <Input id="project-code" name="projectCode" placeholder="PRJ-001" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-status" className="text-xs text-[#374151] tracking-[-0.36px]">Status</Label>
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
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-start" className="text-xs text-[#374151] tracking-[-0.36px]">Start date</Label>
          <Input id="project-start" name="startDate" type="date" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-end" className="text-xs text-[#374151] tracking-[-0.36px]">End date</Label>
          <Input id="project-end" name="endDate" type="date" className="h-9 text-sm" />
        </div>
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
