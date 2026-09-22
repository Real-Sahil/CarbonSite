"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Credential {
  id: string;
  provider: string;
  label: string | null;
  scopes: string[];
  isActive: boolean;
}

export function AddCredentialButton({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const scopesRaw = (fd.get("scopes") as string).trim();
    const body = {
      provider: fd.get("provider") as string,
      label: (fd.get("label") as string) || undefined,
      apiKey: fd.get("apiKey") as string,
      scopes: scopesRaw ? scopesRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    };

    try {
      const res = await fetch(`/api/orgs/${orgId}/carbon-intelligence/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to add credential");
        setLoading(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-[#111827] hover:bg-[#1f2937] text-white text-xs h-8 px-3 gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Add credential
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add API credential</DialogTitle>
            <DialogDescription>Connect an external carbon data source.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="provider" className="text-xs font-medium">Provider *</Label>
                <Input id="provider" name="provider" required placeholder="e.g. electricitymaps" className="h-8 text-sm font-mono" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="label" className="text-xs font-medium">Label</Label>
                <Input id="label" name="label" placeholder="e.g. Production key" className="h-8 text-sm" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apiKey" className="text-xs font-medium">API key *</Label>
              <Input id="apiKey" name="apiKey" type="password" required placeholder="sk-..." className="h-8 text-sm font-mono" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scopes" className="text-xs font-medium">Scopes</Label>
              <Input id="scopes" name="scopes" placeholder="read,signals (comma-separated)" className="h-8 text-sm" />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" size="sm" disabled={loading} className="bg-[#111827] hover:bg-[#1f2937] text-white">
                {loading ? "Adding..." : "Add credential"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditCredentialButton({ orgId, credential }: { orgId: string; credential: Credential }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const apiKey = (fd.get("apiKey") as string).trim();
    const scopesRaw = (fd.get("scopes") as string).trim();
    const body: Record<string, unknown> = {
      label: (fd.get("label") as string) || undefined,
      scopes: scopesRaw ? scopesRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
      isActive: fd.get("isActive") === "true",
    };
    if (apiKey) body.apiKey = apiKey;

    try {
      const res = await fetch(`/api/orgs/${orgId}/carbon-intelligence/integrations/${credential.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to update");
        setLoading(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-7 w-7 p-0 text-[#9CA3AF] hover:text-[#111827]">
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit credential</DialogTitle>
            <DialogDescription>Update <span className="font-mono">{credential.provider}</span> settings. Leave API key blank to keep existing.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-label" className="text-xs font-medium">Label</Label>
              <Input id="edit-label" name="label" defaultValue={credential.label ?? ""} placeholder="e.g. Production key" className="h-8 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-apiKey" className="text-xs font-medium">New API key</Label>
              <Input id="edit-apiKey" name="apiKey" type="password" placeholder="Leave blank to keep current" className="h-8 text-sm font-mono" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-scopes" className="text-xs font-medium">Scopes</Label>
              <Input id="edit-scopes" name="scopes" defaultValue={credential.scopes.join(", ")} placeholder="read,signals" className="h-8 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-isActive" className="text-xs font-medium">Status</Label>
              <select id="edit-isActive" name="isActive" defaultValue={String(credential.isActive)} className="h-8 text-sm rounded-md border border-input bg-background px-3">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" size="sm" disabled={loading} className="bg-[#111827] hover:bg-[#1f2937] text-white">
                {loading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteCredentialButton({ orgId, credentialId, provider }: { orgId: string; credentialId: string; provider: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Delete credential for "${provider}"? This cannot be undone.`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/carbon-intelligence/integrations/${credentialId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to delete");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={loading}
        className="h-7 w-7 p-0 text-[#9CA3AF] hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
