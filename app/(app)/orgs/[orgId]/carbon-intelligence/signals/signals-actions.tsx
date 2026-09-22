"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export function IngestSignalButton({ orgId, signalTypes }: { orgId: string; signalTypes: string[] }) {
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
      signalType: fd.get("signalType") as string,
      source: fd.get("source") as string,
      region: (fd.get("region") as string) || undefined,
      value: Number(fd.get("value")),
      unit: fd.get("unit") as string,
      recordedAt: new Date(fd.get("recordedAt") as string).toISOString(),
    };

    try {
      const res = await fetch(`/api/orgs/${orgId}/carbon-intelligence/signals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to ingest signal");
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

  const today = new Date().toISOString().slice(0, 16);

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-[#111827] hover:bg-[#1f2937] text-white text-xs h-8 px-3 gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Ingest signal
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ingest carbon signal</DialogTitle>
            <DialogDescription>Manually record a carbon data reading.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signalType" className="text-xs font-medium">Signal type *</Label>
                <Input
                  id="signalType"
                  name="signalType"
                  required
                  list="signal-type-list"
                  placeholder="e.g. grid_carbon_intensity"
                  className="h-8 text-sm font-mono"
                />
                <datalist id="signal-type-list">
                  {signalTypes.map((st) => <option key={st} value={st} />)}
                  <option value="grid_carbon_intensity" />
                  <option value="scope1_emissions" />
                  <option value="scope2_emissions" />
                  <option value="air_quality_index" />
                </datalist>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="source" className="text-xs font-medium">Source *</Label>
                <Input id="source" name="source" required placeholder="e.g. National Grid ESO" className="h-8 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5 col-span-2">
                <Label htmlFor="value" className="text-xs font-medium">Value *</Label>
                <Input id="value" name="value" type="number" required step="any" placeholder="0.0" className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="unit" className="text-xs font-medium">Unit *</Label>
                <Input id="unit" name="unit" required placeholder="gCO2/kWh" className="h-8 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="region" className="text-xs font-medium">Region</Label>
                <Input id="region" name="region" placeholder="e.g. GB" className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recordedAt" className="text-xs font-medium">Recorded at *</Label>
                <Input id="recordedAt" name="recordedAt" type="datetime-local" required defaultValue={today} className="h-8 text-sm" />
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" size="sm" disabled={loading} className="bg-[#111827] hover:bg-[#1f2937] text-white">
                {loading ? "Ingesting..." : "Ingest signal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
