"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface FrameworkSummary {
  id: string;
  name: string;
  slug: string;
  version: string | null;
  description: string | null;
  isDefault: boolean;
}

export function CreateFrameworkButton({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name") as string,
      slug: fd.get("slug") as string,
      version: (fd.get("version") as string) || undefined,
      description: (fd.get("description") as string) || undefined,
      isDefault: fd.get("isDefault") === "on",
    };

    try {
      const res = await fetch(`/api/orgs/${orgId}/sv/frameworks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to create framework");
        setLoading(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
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
        New framework
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New framework</DialogTitle>
            <DialogDescription>
              Define a social value measurement framework (e.g. TOMS, PPN06/21, or a custom framework).
            </DialogDescription>
          </DialogHeader>

          <FrameworkForm
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
            onCancel={() => setOpen(false)}
            submitLabel="Create framework"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditFrameworkButton({ orgId, framework }: { orgId: string; framework: FrameworkSummary }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name") as string,
      slug: fd.get("slug") as string,
      version: (fd.get("version") as string) || undefined,
      description: (fd.get("description") as string) || undefined,
      isDefault: fd.get("isDefault") === "on",
    };

    try {
      const res = await fetch(`/api/orgs/${orgId}/sv/frameworks/${framework.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to update framework");
        setLoading(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 text-xs px-2 gap-1"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit framework</DialogTitle>
            <DialogDescription>{framework.name}</DialogDescription>
          </DialogHeader>

          <FrameworkForm
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
            onCancel={() => setOpen(false)}
            submitLabel="Save changes"
            defaultValues={framework}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteFrameworkButton({
  orgId,
  frameworkId,
  name,
  commitmentCount,
}: {
  orgId: string;
  frameworkId: string;
  name: string;
  commitmentCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/sv/frameworks/${frameworkId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to delete framework");
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
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={commitmentCount > 0}
        title={commitmentCount > 0 ? "Cannot delete: has commitments" : "Delete framework"}
        className="h-7 text-xs px-2 gap-1 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete framework?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{name}</strong>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete framework"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FrameworkForm({
  onSubmit,
  loading,
  error,
  onCancel,
  submitLabel,
  defaultValues,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  submitLabel: string;
  defaultValues?: Partial<FrameworkSummary>;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pt-1">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name" className="text-xs font-medium">Name *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaultValues?.name}
          placeholder="e.g. National TOMs 2024"
          className="h-8 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug" className="text-xs font-medium">Slug *</Label>
          <Input
            id="slug"
            name="slug"
            required
            defaultValue={defaultValues?.slug}
            placeholder="e.g. national-toms-2024"
            pattern="^[a-z0-9-]+$"
            className="h-8 text-sm font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="version" className="text-xs font-medium">Version</Label>
          <Input
            id="version"
            name="version"
            defaultValue={defaultValues?.version ?? ""}
            placeholder="e.g. 2024.1"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description" className="text-xs font-medium">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaultValues?.description ?? ""}
          rows={2}
          placeholder="Brief description of this framework..."
          className="text-sm resize-none"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={defaultValues?.isDefault ?? false}
          className="h-3.5 w-3.5 rounded border-[#E5E7EB]"
        />
        <span className="text-xs text-[#374151]">Set as default framework for new commitments</span>
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={loading}
          className="bg-[#111827] hover:bg-[#1f2937] text-white"
        >
          {loading ? "Saving..." : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
