"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CheckCircle, XCircle } from "lucide-react";

interface CommitmentItem {
  id: string;
  title: string;
}

export function CreateActivityButton({ orgId, commitments }: { orgId: string; commitments: CommitmentItem[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      title: fd.get("title") as string,
      activityDate: fd.get("activityDate") as string,
    };

    const commitmentId = fd.get("commitmentId") as string;
    const quantityValue = fd.get("quantityValue") as string;
    const quantityUnit = fd.get("quantityUnit") as string;
    const monetisedValue = fd.get("monetisedValue") as string;
    const notes = fd.get("notes") as string;

    if (commitmentId) body.commitmentId = commitmentId;
    if (quantityValue) body.quantityValue = Number(quantityValue);
    if (quantityUnit) body.quantityUnit = quantityUnit;
    if (monetisedValue) body.monetisedValue = Number(monetisedValue);
    if (notes) body.notes = notes;

    try {
      const res = await fetch(`/api/orgs/${orgId}/sv/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to log activity");
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
        Log activity
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log activity</DialogTitle>
            <DialogDescription>
              Record a social value activity delivered against a commitment.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title" className="text-xs font-medium">Title *</Label>
              <Input id="title" name="title" required placeholder="e.g. Apprentice hired - John Smith" className="h-8 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="commitmentId" className="text-xs font-medium">Commitment</Label>
                <Select name="commitmentId">
                  <SelectTrigger id="commitmentId" className="h-8 text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {commitments.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="activityDate" className="text-xs font-medium">Activity date *</Label>
                <Input id="activityDate" name="activityDate" type="date" required className="h-8 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="monetisedValue" className="text-xs font-medium">Monetised value (£)</Label>
                <Input id="monetisedValue" name="monetisedValue" type="number" min="0" step="0.01" placeholder="0.00" className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quantityValue" className="text-xs font-medium">Quantity</Label>
                <Input id="quantityValue" name="quantityValue" type="number" min="0" step="any" placeholder="0" className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quantityUnit" className="text-xs font-medium">Unit</Label>
                <Input id="quantityUnit" name="quantityUnit" placeholder="e.g. hours" className="h-8 text-sm" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes" className="text-xs font-medium">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} placeholder="Any additional context..." className="text-sm resize-none" />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading} className="bg-[#111827] hover:bg-[#1f2937] text-white">
                {loading ? "Saving..." : "Log activity"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReviewActivityButton({
  orgId,
  activityId,
  title,
}: {
  orgId: string;
  activityId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(status: "approved" | "rejected", notes: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/sv/activities/${activityId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNotes: notes || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Review failed");
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
        className="h-7 text-xs px-2"
      >
        Review
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review activity</DialogTitle>
            <DialogDescription className="truncate">{title}</DialogDescription>
          </DialogHeader>

          <ReviewForm onSubmit={submit} loading={loading} error={error} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReviewForm({
  onSubmit,
  loading,
  error,
  onCancel,
}: {
  onSubmit: (status: "approved" | "rejected", notes: string) => void;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState("");

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium">Review notes (optional)</Label>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes for the submitter..."
          className="text-sm resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => onSubmit("rejected", notes)}
          disabled={loading}
          variant="destructive"
          className="flex-1 gap-1.5"
        >
          <XCircle className="h-3.5 w-3.5" />
          Reject
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => onSubmit("approved", notes)}
          disabled={loading}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Approve
        </Button>
      </div>
    </div>
  );
}
