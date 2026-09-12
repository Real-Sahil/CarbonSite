"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export type SpeciesRecord = {
  name: string;
  commonName: string | null;
  kingdom: string;
  group: string;
  occurrenceCount: number;
  lastSeen: string | null;
  conservationStatus?: string;
};

const RISK_PRIORITY: Record<string, number> = {
  critical: 0, endangered: 1, vulnerable: 2,
  near_threatened: 3, protected: 4, least_concern: 5, unknown: 6,
};

function riskLevel(status: string | undefined): string {
  if (!status) return "unknown";
  const s = status.toLowerCase();
  if (/critically.endangered|\bcr\b/.test(s)) return "critical";
  if (/\bendangered\b|\ben\b/.test(s)) return "endangered";
  if (/vulnerable|\bvu\b/.test(s)) return "vulnerable";
  if (/near.threatened|\bnt\b/.test(s)) return "near_threatened";
  if (/schedule [158]|protected|wildlife.*act/i.test(s)) return "protected";
  if (/least.concern|\blc\b/.test(s)) return "least_concern";
  return "unknown";
}

const RISK_BADGE: Record<string, { label: string; cls: string }> = {
  critical:        { label: "CR",   cls: "bg-red-100 text-red-800 border-red-300" },
  endangered:      { label: "EN",   cls: "bg-orange-100 text-orange-800 border-orange-300" },
  vulnerable:      { label: "VU",   cls: "bg-amber-100 text-amber-800 border-amber-300" },
  near_threatened: { label: "NT",   cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  protected:       { label: "Protected", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  least_concern:   { label: "LC",   cls: "bg-green-100 text-green-800 border-green-300" },
};

const PAGE_SIZE = 50;

export function SpeciesTable({ species }: { species: SpeciesRecord[] }) {
  const [limit, setLimit] = useState(PAGE_SIZE);

  const sorted = [...species].sort((a, b) => {
    const pa = RISK_PRIORITY[riskLevel(a.conservationStatus)] ?? 6;
    const pb = RISK_PRIORITY[riskLevel(b.conservationStatus)] ?? 6;
    return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
  });

  const visible = sorted.slice(0, limit);

  return (
    <div className="space-y-2">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scientific name</TableHead>
              <TableHead>Common name</TableHead>
              <TableHead>Group</TableHead>
              <TableHead className="text-right">Occurrences</TableHead>
              <TableHead>Last recorded</TableHead>
              <TableHead>Conservation status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((s, i) => {
              const risk = riskLevel(s.conservationStatus);
              const badge = RISK_BADGE[risk];
              return (
                <TableRow key={i}>
                  <TableCell className="italic font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.commonName ?? "—"}</TableCell>
                  <TableCell>{s.group}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.occurrenceCount}</TableCell>
                  <TableCell>{s.lastSeen ?? "—"}</TableCell>
                  <TableCell>
                    {badge ? (
                      <Badge variant="outline" className={`text-xs ${badge.cls}`}>
                        {badge.label}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {sorted.length > limit && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {limit} of {sorted.length} species</span>
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, sorted.length - limit)} more
          </Button>
        </div>
      )}
      {limit >= sorted.length && sorted.length > PAGE_SIZE && (
        <p className="text-xs text-muted-foreground">All {sorted.length} species shown.</p>
      )}
    </div>
  );
}

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
