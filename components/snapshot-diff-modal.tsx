"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ScopeDiff = {
  scope: number;
  fromCo2e: number;
  toCo2e: number;
  delta: number;
  deltaPercent: number | null;
};

type DiffData = {
  fromSnapshotVersion: number;
  scopeDiffs: ScopeDiff[];
  totalFrom: number;
  totalTo: number;
  totalDelta: number;
  totalDeltaPercent: number | null;
};

type SnapshotDiffModalProps = {
  orgId: string;
  fromSnapshotId: string;
  toCalculationRunId: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function formatTonnes(kg: number): string {
  return `${(kg / 1000).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} tCO2e`;
}

function formatDeltaPercent(pct: number | null): string {
  if (pct === null) return "n/a";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function DeltaCell({ delta, deltaPercent }: { delta: number; deltaPercent: number | null }) {
  // Negative delta = fewer emissions = good (green). Positive = more = bad (red).
  const isZero = Math.abs(delta) < 0.001;
  const colorClass = isZero
    ? "text-[#374151]"
    : delta < 0
      ? "text-green-700"
      : "text-red-600";

  const sign = delta > 0 ? "+" : "";

  return (
    <TableCell className={`text-right font-medium ${colorClass}`}>
      {sign}
      {formatTonnes(delta)}
      {!isZero && (
        <span className="ml-1.5 text-xs font-normal opacity-75">
          ({formatDeltaPercent(deltaPercent)})
        </span>
      )}
    </TableCell>
  );
}

export function SnapshotDiffModal({
  orgId,
  fromSnapshotId,
  toCalculationRunId,
  onConfirm,
  onCancel,
}: SnapshotDiffModalProps) {
  const [diff, setDiff] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      fromSnapshotId,
      toCalculationRunId,
    });
    fetch(`/api/orgs/${orgId}/snapshots/diff?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? "Failed to load diff");
        }
        return res.json() as Promise<DiffData>;
      })
      .then((data) => {
        setDiff(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load diff");
        setLoading(false);
      });
  }, [orgId, fromSnapshotId, toCalculationRunId]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {diff
              ? `Publishing will replace snapshot v${diff.fromSnapshotVersion}`
              : "Compare snapshots"}
          </DialogTitle>
          <DialogDescription>
            Review what changed before publishing. Totals are in tCO2e. Green = fewer emissions,
            red = more emissions.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-10 text-center text-sm text-[#374151]">Loading diff…</div>
        )}

        {error && (
          <div className="py-10 text-center text-sm text-red-600">{error}</div>
        )}

        {diff && !loading && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead className="text-right">Current (published)</TableHead>
                <TableHead className="text-right">New (this run)</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diff.scopeDiffs.map((row) => (
                <TableRow key={row.scope}>
                  <TableCell className="font-medium text-[#111827]">
                    Scope {row.scope}
                  </TableCell>
                  <TableCell className="text-right text-[#374151]">
                    {formatTonnes(row.fromCo2e)}
                  </TableCell>
                  <TableCell className="text-right text-[#374151]">
                    {formatTonnes(row.toCo2e)}
                  </TableCell>
                  <DeltaCell delta={row.delta} deltaPercent={row.deltaPercent} />
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-[#E5E7EB]">
                <TableCell className="font-semibold text-[#111827]">Total</TableCell>
                <TableCell className="text-right font-semibold text-[#111827]">
                  {formatTonnes(diff.totalFrom)}
                </TableCell>
                <TableCell className="text-right font-semibold text-[#111827]">
                  {formatTonnes(diff.totalTo)}
                </TableCell>
                <DeltaCell delta={diff.totalDelta} deltaPercent={diff.totalDeltaPercent} />
              </TableRow>
            </TableBody>
          </Table>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading || !!error}
            className="bg-[#0EA5E9] text-white hover:bg-[#0EA5E9]/90"
          >
            Publish new snapshot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
