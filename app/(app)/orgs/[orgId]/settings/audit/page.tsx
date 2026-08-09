"use client";

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
  "auth.sign_in": "bg-blue-50 text-blue-700",
  "auth.sign_out": "bg-zinc-100 text-zinc-600",
  "record.created": "bg-emerald-50 text-emerald-700",
  "record.updated": "bg-amber-50 text-amber-700",
  "record.deleted": "bg-red-50 text-red-700",
  "import.committed": "bg-emerald-50 text-emerald-700",
  "import.failed": "bg-red-50 text-red-700",
  "snapshot.published": "bg-purple-50 text-purple-700",
  "report.published": "bg-purple-50 text-purple-700",
  "field_submission.approved": "bg-emerald-50 text-emerald-700",
  "field_submission.rejected": "bg-red-50 text-red-700",
  "audit.export_downloaded": "bg-zinc-100 text-zinc-600",
};

function ActionBadge({ action }: { action: string }) {
  const colours = ACTION_COLOURS[action] ?? "bg-zinc-100 text-zinc-600";
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
          <h2 className="text-[22px] font-normal tracking-[-0.44px] text-[#111827]">
            Audit Log
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">
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
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
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
          className="h-8 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="">All actions</option>
          <option value="record">record.*</option>
          <option value="import">import.*</option>
          <option value="field_submission">field_submission.*</option>
          <option value="auth">auth.*</option>
          <option value="snapshot">snapshot.*</option>
          <option value="report">report.*</option>
          <option value="audit">audit.*</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-[#E5E7EB]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#f9fafb]">
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500 tracking-wider">
                Time
              </th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500 tracking-wider">
                Action
              </th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500 tracking-wider">
                Resource
              </th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500 tracking-wider">
                Actor
              </th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500 tracking-wider">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb]">
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-400">
                  No audit entries found.
                </td>
              </tr>
            )}
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-[#f9fafb] transition-colors">
                <td className="px-4 py-2.5 text-xs font-mono text-zinc-500 whitespace-nowrap">
                  {formatTime(log.createdAt)}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <ActionBadge action={log.action} />
                </td>
                <td className="px-4 py-2.5 text-xs text-zinc-700">
                  <span className="text-zinc-400">{log.resourceType}/</span>
                  <span className="font-mono">{log.resourceId.slice(0, 8)}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-zinc-600">
                  {log.actor ? (
                    <span title={log.actor.email}>{log.actor.name ?? log.actor.email}</span>
                  ) : (
                    <span className="text-zinc-400">System</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs font-mono text-zinc-400 max-w-[260px] truncate">
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
