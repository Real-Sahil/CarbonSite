"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle, Plus } from "lucide-react";

export function ResolveAlertButton({ orgId, alertId, title }: { orgId: string; alertId: string; title: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleResolve() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/carbon-intelligence/alerts/${alertId}/resolve`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to resolve");
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
        variant="outline"
        size="sm"
        onClick={handleResolve}
        disabled={loading}
        className="h-7 text-xs px-2 gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
        title={`Resolve: ${title}`}
      >
        <CheckCircle className="h-3 w-3" />
        Resolve
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function CreateAlertButton({ orgId }: { orgId: string }) {
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
      alertType: fd.get("alertType") as string,
      severity: fd.get("severity") as string,
      title: fd.get("title") as string,
      message: fd.get("message") as string,
    };

    try {
      const res = await fetch(`/api/orgs/${orgId}/carbon-intelligence/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to create alert");
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
        New alert
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New alert</DialogTitle>
            <DialogDescription>Manually raise an impact alert.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title" className="text-xs font-medium">Title *</Label>
              <Input id="title" name="title" required placeholder="e.g. Scope 1 emissions above threshold" className="h-8 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="alertType" className="text-xs font-medium">Alert type *</Label>
                <Input id="alertType" name="alertType" required placeholder="e.g. scope1_threshold" className="h-8 text-sm font-mono" />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="severity" className="text-xs font-medium">Severity</Label>
                <Select name="severity" defaultValue="medium">
                  <SelectTrigger id="severity" className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="message" className="text-xs font-medium">Message *</Label>
              <Textarea id="message" name="message" required rows={3} placeholder="Describe what triggered this alert..." className="text-sm resize-none" />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" size="sm" disabled={loading} className="bg-[#111827] hover:bg-[#1f2937] text-white">
                {loading ? "Creating..." : "Create alert"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
