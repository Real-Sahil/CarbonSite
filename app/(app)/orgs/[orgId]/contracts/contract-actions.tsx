"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateContractForm({ orgId }: { orgId: string }) {
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
      clientName: (data.get("clientName") as string) || undefined,
      contractReference: (data.get("contractReference") as string) || undefined,
      status: data.get("status") as string,
      startDate: (data.get("startDate") as string) || undefined,
      endDate: (data.get("endDate") as string) || undefined,
      ppn0621Required: data.get("ppn0621Required") === "on",
      nhsEvergreenRequired: data.get("nhsEvergreenRequired") === "on",
      breeamRequired: data.get("breeamRequired") === "on",
    };
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.message ?? "Could not create contract");
        return;
      }
      form.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[14px] border border-[#E2E8F0] p-[21px] flex flex-col gap-4">
      <p className="text-sm font-normal text-[#0F172A] tracking-[-0.42px]">New contract</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contract-name" className="text-xs text-[#475569] tracking-[-0.36px]">Name <span aria-hidden="true" className="text-red-500">*</span></Label>
          <Input id="contract-name" name="name" required placeholder="Contract name" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contract-client" className="text-xs text-[#475569] tracking-[-0.36px]">Client name</Label>
          <Input id="contract-client" name="clientName" placeholder="Client organisation" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contract-ref" className="text-xs text-[#475569] tracking-[-0.36px]">Contract reference</Label>
          <Input id="contract-ref" name="contractReference" placeholder="REF-001" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contract-status" className="text-xs text-[#475569] tracking-[-0.36px]">Status</Label>
          <select
            id="contract-status"
            name="status"
            defaultValue="active"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contract-start" className="text-xs text-[#475569] tracking-[-0.36px]">Start date</Label>
          <Input id="contract-start" name="startDate" type="date" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contract-end" className="text-xs text-[#475569] tracking-[-0.36px]">End date</Label>
          <Input id="contract-end" name="endDate" type="date" className="h-9 text-sm" />
        </div>
      </div>
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm text-[#475569] tracking-[-0.42px] cursor-pointer">
          <input type="checkbox" name="ppn0621Required" className="h-4 w-4 rounded border-gray-300" />
          PPN 06/21 required
        </label>
        <label className="flex items-center gap-2 text-sm text-[#475569] tracking-[-0.42px] cursor-pointer">
          <input type="checkbox" name="nhsEvergreenRequired" className="h-4 w-4 rounded border-gray-300" />
          NHS Evergreen required
        </label>
        <label className="flex items-center gap-2 text-sm text-[#475569] tracking-[-0.42px] cursor-pointer">
          <input type="checkbox" name="breeamRequired" className="h-4 w-4 rounded border-gray-300" />
          BREEAM required
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Creating…" : "Create contract"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteContractButton({ orgId, contractId, name }: { orgId: string; contractId: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Delete contract "${name}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/contracts/${contractId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.message ?? "Could not delete contract");
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
        title="Delete contract"
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
