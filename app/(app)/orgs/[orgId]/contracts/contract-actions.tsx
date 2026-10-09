"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormActions, FormError, FormSection, fieldClass } from "@/components/forms/form-kit";

export function CreateContractForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    fetch(`/api/orgs/${orgId}/business-units`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setUnits(Array.isArray(d) ? d : (d.data ?? d.businessUnits ?? [])); }).catch(() => null);
  }, [orgId]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const body = {
      name: data.get("name") as string,
      clientName: (data.get("clientName") as string) || undefined,
      contractReference: (data.get("contractReference") as string) || undefined,
      businessUnitId: (data.get("businessUnitId") as string) || undefined,
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
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-[#E5E7EB] bg-white p-4 sm:p-5">
      <FormSection title="New contract" cols={3}>
          <FormField label="Name" span={4} htmlFor="contract-name">
            <Input id="contract-name" name="name" required placeholder="Contract name" />
          </FormField>
          <FormField label="Client name" htmlFor="contract-client" optional>
            <Input id="contract-client" name="clientName" placeholder="Client organisation" />
          </FormField>
          <FormField label="Contract reference" htmlFor="contract-ref" optional>
            <Input id="contract-ref" name="contractReference" placeholder="REF-001" />
          </FormField>
          {units.length > 0 && (
            <FormField label="Business unit" htmlFor="contract-unit" optional hint="Used to compare units in the KPI report.">
              <select id="contract-unit" name="businessUnitId" defaultValue="" className={fieldClass}>
                <option value="">None</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </FormField>
          )}
          <FormField label="Status" htmlFor="contract-status" optional>
            <select
              id="contract-status"
              name="status"
              defaultValue="active"
              className={fieldClass}
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </FormField>
          <FormField label="Start date" htmlFor="contract-start" optional>
            <Input id="contract-start" name="startDate" type="date" />
          </FormField>
          <FormField label="End date" htmlFor="contract-end" optional>
            <Input id="contract-end" name="endDate" type="date" />
          </FormField>
        </FormSection>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-zinc-900">Reports the client requires</legend>
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm text-[#374151] tracking-[-0.42px] cursor-pointer">
            <input type="checkbox" name="ppn0621Required" className="h-4 w-4 rounded border-gray-300" />
            PPN 06/21 required
          </label>
          <label className="flex items-center gap-2 text-sm text-[#374151] tracking-[-0.42px] cursor-pointer">
            <input type="checkbox" name="nhsEvergreenRequired" className="h-4 w-4 rounded border-gray-300" />
            NHS Evergreen required
          </label>
          <label className="flex items-center gap-2 text-sm text-[#374151] tracking-[-0.42px] cursor-pointer">
            <input type="checkbox" name="breeamRequired" className="h-4 w-4 rounded border-gray-300" />
            BREEAM required
          </label>
        </div>
      </fieldset>
      <FormError>{error}</FormError>
      <FormActions>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Creating…" : "Create contract"}
        </Button>
      </FormActions>
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
