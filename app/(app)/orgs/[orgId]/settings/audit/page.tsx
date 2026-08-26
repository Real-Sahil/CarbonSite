"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Download, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  createdAt: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actor: { name: string | null; email: string } | null;
  metadata: Record<string, unknown>;
}

const ACTION_COLOURS: Record<string, string> = {
  "auth.sign_in": "bg-blue-500/15 text-blue-300",
  "auth.sign_out": "bg-white/8 text-white/50",
  "record.created": "bg-emerald-500/15 text-emerald-300",
  "record.updated": "bg-amber-500/15 text-amber-300",
  "record.deleted": "bg-red-500/15 text-red-400",
  "import.committed": "bg-emerald-500/15 text-emerald-300",
  "import.failed": "bg-red-500/15 text-red-400",
  "snapshot.published": "bg-purple-500/15 text-purple-300",
  "report.published": "bg-purple-500/15 text-purple-300",
  "field_submission.approved": "bg-emerald-500/15 text-emerald-300",
  "field_submission.rejected": "bg-red-500/15 text-red-400",
  "audit.export_downloaded": "bg-white/8 text-white/50",
};

function ActionBadge({ action }: { action: string }) {
  const colours = ACTION_COLOURS[action] ?? "bg-white/8 text-white/50";
  return (
    <span className={cn("text-[11px] font-mono rounded px-1.5 py-0.5 tracking-tight", colours)}>
      {action}
    </span>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function AuditLogPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const fetchLogs = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ limit: "50" });
        if (cursor) qs.set("cursor", cursor);
        if (actionFilter) qs.set("action", actionFilter);
        const res = await fetch(`/api/orgs/${orgId}/audit-logs?${qs}`);
        if (!res.ok) throw new Error("Failed to fetch audit logs");
        const json = await res.json();
        setLogs((prev) => (cursor ? [...prev, ...json.data] : json.data));
        setNextCursor(json.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    [orgId, actionFilter],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs();
  }, [fetchLogs]);

  async function handleExport(format: "csv" | "json") {
    setExporting(true);
    try {
      const qs = new URLSearchParams({ format });
      if (actionFilter) qs.set("action", actionFilter);
      const res = await fetch(`/api/orgs/${orgId}/audit-logs/export?${qs}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${orgId}-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const filtered = search
    ? logs.filter(
        (l) =>
          l.action.includes(search.toLowerCase()) ||
          l.resourceType.toLowerCase().includes(search.toLowerCase()) ||
          l.resourceId.toLowerCase().includes(search.toLowerCase()) ||
          (l.actor?.email ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : logs;

  return (
    <div className="flex flex-col gap-[28px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-normal tracking-[-0.44px] text-white">
            Audit Log
          </h2>
          <p className="text-sm text-white/50 mt-0.5">
            Immutable record of all actions in this organisation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="gap-1.5 text-xs"
          >
            <Download aria-hidden className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("json")}
            disabled={exporting}
            className="gap-1.5 text-xs"
          >
            <Download aria-hidden className="h-3.5 w-3.5" />
            Export JSON
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchLogs()}
            disabled={loading}
            aria-label="Refresh"
          >
            <RefreshCw aria-hidden className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-[340px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, resource, or actor..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setLogs([]);
          }}
          className="h-8 rounded-md border border-white/12 bg-white/6 px-3 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
        >
          <option value="" className="bg-[#0d0d1a]">All actions</option>
          <option value="record" className="bg-[#0d0d1a]">record.*</option>
          <option value="import" className="bg-[#0d0d1a]">import.*</option>
          <option value="field_submission" className="bg-[#0d0d1a]">field_submission.*</option>
          <option value="auth" className="bg-[#0d0d1a]">auth.*</option>
          <option value="snapshot" className="bg-[#0d0d1a]">snapshot.*</option>
          <option value="report" className="bg-[#0d0d1a]">report.*</option>
          <option value="audit" className="bg-[#0d0d1a]">audit.*</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-white/8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 bg-white/3">
              <th className="px-4 py-2.5 text-left font-normal text-xs text-white/40 tracking-wider">
                Time
              </th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-white/40 tracking-wider">
                Action
              </th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-white/40 tracking-wider">
                Resource
              </th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-white/40 tracking-wider">
                Actor
              </th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-white/40 tracking-wider">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-white/30">
                  No audit entries found.
                </td>
              </tr>
            )}
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-2.5 text-xs font-mono text-white/40 whitespace-nowrap">
                  {formatTime(log.createdAt)}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <ActionBadge action={log.action} />
                </td>
                <td className="px-4 py-2.5 text-xs text-white/60">
                  <span className="text-white/30">{log.resourceType}/</span>
                  <span className="font-mono">{log.resourceId.slice(0, 8)}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-white/60">
                  {log.actor ? (
                    <span title={log.actor.email}>{log.actor.name ?? log.actor.email}</span>
                  ) : (
                    <span className="text-white/30">System</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs font-mono text-white/30 max-w-[260px] truncate">
                  {Object.keys(log.metadata ?? {}).length > 0
                    ? JSON.stringify(log.metadata)
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(nextCursor)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
