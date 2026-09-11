"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScanLine, Loader2, Trash2 } from "lucide-react";

export function RunScanDialog({
  orgId,
  projectId,
  defaultPostcode,
}: {
  orgId: string;
  projectId: string;
  defaultPostcode?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [postcode, setPostcode] = useState(defaultPostcode ?? "");
  const [radiusKm, setRadiusKm] = useState("1");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!postcode.trim()) {
      setError("Enter a UK postcode.");
      return;
    }
    setError(null);
    setRunning(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/projects/${projectId}/ecology/scans`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postcode: postcode.trim(),
            radiusKm: parseFloat(radiusKm) || 1,
          }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? "Scan failed.");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <ScanLine className="mr-2 h-4 w-4" />
          Run ecology scan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Run ecology scan</DialogTitle>
          <DialogDescription>
            Fetches live species, habitat designation, and woodland data from
            NBN Atlas, Natural England MAGIC, and the Forestry Commission.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="postcode">UK postcode</Label>
            <Input
              id="postcode"
              placeholder="e.g. SW1A 1AA"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              disabled={running}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="radius">Search radius (km)</Label>
            <Input
              id="radius"
              type="number"
              min="0.1"
              max="20"
              step="0.5"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
              disabled={running}
            />
            <p className="text-xs text-muted-foreground">
              Species radius. Designated sites always use at least 5 km.
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={running}>
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              "Run scan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteScanButton({
  orgId,
  projectId,
  scanId,
}: {
  orgId: string;
  projectId: string;
  scanId: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this scan? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(
        `/api/orgs/${orgId}/projects/${projectId}/ecology/scans/${scanId}`,
        { method: "DELETE" }
      );
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-red-600"
      onClick={handleDelete}
      disabled={deleting}
    >
      {deleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </Button>
  );
}
