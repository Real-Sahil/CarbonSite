"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateSiteForm({
  orgId,
  contractId,
  projectId,
}: {
  orgId: string;
  contractId: string;
  projectId: string;
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
      siteCode: (data.get("siteCode") as string) || undefined,
      postcode: (data.get("postcode") as string) || undefined,
      addressLine1: (data.get("addressLine1") as string) || undefined,
      city: (data.get("city") as string) || undefined,
      country: (data.get("country") as string) || "GB",
    };
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/contracts/${contractId}/projects/${projectId}/sites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.message ?? "Could not create site");
        return;
      }
      form.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[14px] border border-[#E2E8F0] p-[21px] flex flex-col gap-4">
      <p className="text-sm font-normal text-[#0F172A] tracking-[-0.42px]">New site</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="site-name" className="text-xs text-[#475569] tracking-[-0.36px]">
            Name <span aria-hidden="true" className="text-red-500">*</span>
          </Label>
          <Input id="site-name" name="name" required placeholder="Site name" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="site-code" className="text-xs text-[#475569] tracking-[-0.36px]">Site code</Label>
          <Input id="site-code" name="siteCode" placeholder="SITE-001" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="site-postcode" className="text-xs text-[#475569] tracking-[-0.36px]">Postcode</Label>
          <Input id="site-postcode" name="postcode" placeholder="SW1A 1AA" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="site-address" className="text-xs text-[#475569] tracking-[-0.36px]">Address line 1</Label>
          <Input id="site-address" name="addressLine1" placeholder="1 Example Street" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="site-city" className="text-xs text-[#475569] tracking-[-0.36px]">City</Label>
          <Input id="site-city" name="city" placeholder="London" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="site-country" className="text-xs text-[#475569] tracking-[-0.36px]">Country</Label>
          <Input id="site-country" name="country" defaultValue="GB" placeholder="GB" className="h-9 text-sm" />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Creating…" : "Create site"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteSiteButton({
  orgId,
  contractId,
  projectId,
  siteId,
  name,
}: {
  orgId: string;
  contractId: string;
  projectId: string;
  siteId: string;
  name: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Delete site "${name}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/contracts/${contractId}/projects/${projectId}/sites/${siteId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.message ?? "Could not delete site");
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
        title="Delete site"
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
