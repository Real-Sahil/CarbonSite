"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function SeedLibrariesButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function seed() {
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/factor-libraries", { method: "POST" });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.message ?? "Seed failed");
        setResult(`DEFRA 2025.1 and EPA 2025.1 are now in the database.`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Seed failed");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={seed}
        disabled={isPending}
        className="w-fit gap-1.5"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Seeding…" : "Seed standard libraries"}
      </Button>
      {result && <p className="text-xs text-green-700">{result}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
