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
import { Plus } from "lucide-react";

interface SimpleItem {
  id: string;
  name: string;
}

interface PeriodItem {
  id: string;
  label: string;
}

interface FrameworkItem {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  orgId: string;
  contracts: SimpleItem[];
  periods: PeriodItem[];
  frameworks: FrameworkItem[];
}

export function CreateCommitmentButton({ orgId, contracts, periods, frameworks }: Props) {
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
    };

    const contractId = fd.get("contractId") as string;
    const frameworkId = fd.get("frameworkId") as string;
    const reportingPeriodId = fd.get("reportingPeriodId") as string;
    const targetDate = fd.get("targetDate") as string;
    const targetValue = fd.get("targetValue") as string;
    const targetUnit = fd.get("targetUnit") as string;
    const monetisedValue = fd.get("monetisedValue") as string;

    if (contractId) body.contractId = contractId;
    if (frameworkId) body.frameworkId = frameworkId;
    if (reportingPeriodId) body.reportingPeriodId = reportingPeriodId;
    if (targetDate) body.targetDate = new Date(targetDate).toISOString();
    if (targetValue) body.targetValue = Number(targetValue);
    if (targetUnit) body.targetUnit = targetUnit;
    if (monetisedValue) body.monetisedValue = Number(monetisedValue);

    try {
      const res = await fetch(`/api/orgs/${orgId}/sv/commitments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to create commitment");
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
        New commitment
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New commitment</DialogTitle>
            <DialogDescription>
              Create a social value commitment. Link it to a contract, framework, and reporting period.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title" className="text-xs font-medium">Title *</Label>
              <Input id="title" name="title" required placeholder="e.g. Employ 5 local apprentices" className="h-8 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contractId" className="text-xs font-medium">Contract</Label>
                <Select name="contractId">
                  <SelectTrigger id="contractId" className="h-8 text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="frameworkId" className="text-xs font-medium">Framework</Label>
                <Select name="frameworkId">
                  <SelectTrigger id="frameworkId" className="h-8 text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {frameworks.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reportingPeriodId" className="text-xs font-medium">Reporting period</Label>
                <Select name="reportingPeriodId">
                  <SelectTrigger id="reportingPeriodId" className="h-8 text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="targetDate" className="text-xs font-medium">Target date</Label>
                <Input id="targetDate" name="targetDate" type="date" className="h-8 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="monetisedValue" className="text-xs font-medium">Monetised target (£)</Label>
                <Input id="monetisedValue" name="monetisedValue" type="number" min="0" step="0.01" placeholder="0.00" className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="targetValue" className="text-xs font-medium">Qty target</Label>
                <Input id="targetValue" name="targetValue" type="number" min="0" step="any" placeholder="0" className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="targetUnit" className="text-xs font-medium">Unit</Label>
                <Input id="targetUnit" name="targetUnit" placeholder="e.g. jobs" className="h-8 text-sm" />
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading} className="bg-[#111827] hover:bg-[#1f2937] text-white">
                {loading ? "Creating..." : "Create commitment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
