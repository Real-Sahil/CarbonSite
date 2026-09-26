"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function AdoptButton({ orgId, slug, label }: { orgId: string; slug: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function adopt() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/management-systems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameworkSlug: slug }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        return setError(json?.message ?? "Could not adopt this framework.");
      }
      router.push(`/orgs/${orgId}/management-systems/${slug}`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={adopt} disabled={isPending} className="whitespace-nowrap bg-[#c2410c] text-white hover:bg-[#9a3412]">
        {isPending ? "Adopting…" : label}
      </Button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
