"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, CheckCircle2 } from "lucide-react";

export function LookupLeiButton({
  orgId,
  entityId,
  hasLei,
}: {
  orgId: string;
  entityId: string;
  hasLei: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ found: boolean; lei?: string; legalName?: string } | null>(null);

  async function lookup() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/legal-entities/${entityId}/lookup-lei`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({ found: false }))) as {
        found: boolean;
        lei?: string;
        legalName?: string;
      };
      setResult(data);
      if (data.found) router.refresh();
    } catch {
      window.alert("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={lookup}
        disabled={loading}
        title={hasLei ? "Re-check GLEIF" : "Look up LEI via GLEIF"}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#E3E8EE] bg-white px-2.5 py-1 text-xs font-medium text-[#41505F] hover:bg-[#F9FAFC] disabled:opacity-50 transition-colors"
      >
        {loading
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <Search className="h-3 w-3" />
        }
        {hasLei ? "Refresh LEI" : "Look up LEI"}
      </button>
      {result !== null && !loading && (
        <span className={`text-xs ${result.found ? "text-green-600" : "text-[#5B6A78]"}`}>
          {result.found
            ? <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {result.lei}</span>
            : "Not found in GLEIF"
          }
        </span>
      )}
    </div>
  );
}
