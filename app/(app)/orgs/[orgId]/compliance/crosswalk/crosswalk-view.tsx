"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, Zap, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface Datapoint {
  id: string;
  framework: string;
  code: string;
  title: string;
  description: string;
  category: string | null;
  resolverKey: string | null;
  status: string;
  evidenceSummary: string;
  source: "automatic" | "manual";
  manualEvidenceSummary: string | null;
}

interface FrameworkSummary {
  framework: string;
  label: string;
  total: number;
  applicable: number;
  satisfied: number;
  partial: number;
  gap: number;
  readinessPercent: number;
}

export function CrosswalkView({
  orgId,
  canEdit,
  frameworkSummaries,
  datapoints,
}: {
  orgId: string;
  canEdit: boolean;
  frameworkSummaries: FrameworkSummary[];
  datapoints: Datapoint[];
}) {
  const [activeFramework, setActiveFramework] = useState<string>(frameworkSummaries[0]?.framework ?? "");

  const visible = datapoints.filter((d) => d.framework === activeFramework);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-900">Framework datapoint crosswalk</h1>
        <p className="mt-0.5 max-w-[70ch] text-sm text-zinc-500">
          For each disclosure requirement: whether this organisation's own data actually answers it
          today, checked live, or whether it still needs manual evidence. &ldquo;Ready for CSRD&rdquo;
          is a checkable claim here, not a slogan.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {frameworkSummaries.map((f) => (
          <button
            key={f.framework}
            onClick={() => setActiveFramework(f.framework)}
            className={cn(
              "rounded-lg border p-4 text-left transition-colors",
              activeFramework === f.framework
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white hover:border-zinc-300",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{f.label}</span>
              <span className={cn("font-mono text-lg font-semibold tabular-nums", activeFramework === f.framework ? "text-white" : "text-zinc-900")}>
                {f.readinessPercent.toFixed(0)}%
              </span>
            </div>
            <div
              className={cn(
                "mt-2 h-1.5 w-full overflow-hidden rounded-full",
                activeFramework === f.framework ? "bg-white/20" : "bg-zinc-100",
              )}
            >
              <div
                className={cn("h-full rounded-full", activeFramework === f.framework ? "bg-white" : "bg-zinc-900")}
                style={{ width: `${f.readinessPercent}%` }}
              />
            </div>
            <p className={cn("mt-2 text-xs", activeFramework === f.framework ? "text-white/70" : "text-zinc-500")}>
              {f.satisfied} satisfied · {f.partial} partial · {f.gap} gap
            </p>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visible.map((dp) => (
          <DatapointRow key={dp.id} orgId={orgId} datapoint={dp} canEdit={canEdit} />
        ))}
      </div>
    </div>
  );
}

function DatapointRow({
  orgId,
  datapoint,
  canEdit,
}: {
  orgId: string;
  datapoint: Datapoint;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(datapoint.status);
  const [evidenceSummary, setEvidenceSummary] = useState(datapoint.manualEvidenceSummary ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/compliance/crosswalk/${datapoint.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, evidenceSummary: evidenceSummary || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? "Could not save this override.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <StatusIcon status={datapoint.status} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-400">{datapoint.code}</span>
                <span className="font-medium text-zinc-900">{datapoint.title}</span>
                {datapoint.source === "automatic" && (
                  <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                    <Zap className="h-3 w-3" />
                    Live
                  </span>
                )}
              </div>
              <p className="mt-0.5 max-w-[60ch] text-xs text-zinc-500">{datapoint.description}</p>
            </div>
          </div>
          <StatusBadge status={datapoint.status} />
        </div>

        <p className="ml-7 max-w-[65ch] text-sm text-zinc-600">{datapoint.evidenceSummary}</p>

        {canEdit && (
          <div className="ml-7">
            {editing ? (
              <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  <option value="satisfied">Satisfied</option>
                  <option value="partial">Partial</option>
                  <option value="gap">Gap</option>
                  <option value="not_applicable">Not applicable</option>
                </select>
                <Textarea
                  value={evidenceSummary}
                  onChange={(e) => setEvidenceSummary(e.target.value)}
                  placeholder="What evidence supports this position."
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={save} disabled={saving}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 px-2 text-xs">
                <Pencil className="mr-1 h-3 w-3" />
                {datapoint.source === "manual" ? "Record evidence" : "Override"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "satisfied") return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />;
  if (status === "partial") return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />;
  if (status === "gap") return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />;
  return <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300" />;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "satisfied") {
    return <Badge className="bg-green-100 text-xs text-green-900 hover:bg-green-100">Satisfied</Badge>;
  }
  if (status === "partial") {
    return <Badge className="bg-amber-100 text-xs text-amber-900 hover:bg-amber-100">Partial</Badge>;
  }
  if (status === "gap") {
    return <Badge className="bg-red-100 text-xs text-red-900 hover:bg-red-100">Gap</Badge>;
  }
  return (
    <Badge variant="outline" className="text-xs">
      Not applicable
    </Badge>
  );
}
