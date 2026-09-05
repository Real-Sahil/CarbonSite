"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface DeleteImportButtonProps {
  orgId: string;
  importId: string;
}

export function DeleteImportButton({ orgId, importId }: DeleteImportButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this import batch? This cannot be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/imports/${importId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs text-zinc-500 hover:text-red-600 hover:bg-red-50"
      onClick={handleDelete}
      disabled={loading}
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  );
}
