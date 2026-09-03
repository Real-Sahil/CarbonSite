"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Copy, Check, Eye, ToggleLeft, ToggleRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ALL_EVENTS = [
  "calculation_run.completed",
  "report.ready",
  "field_submission.approved",
  "field_submission.rejected",
  "import.committed",
] as const;

type WebhookEvent = (typeof ALL_EVENTS)[number];

const EVENT_LABELS: Record<WebhookEvent, string> = {
  "calculation_run.completed": "Calculation run completed",
  "report.ready": "Report ready",
  "field_submission.approved": "Field submission approved",
  "field_submission.rejected": "Field submission rejected",
  "import.committed": "Import committed",
};

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  createdAt: string;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded text-zinc-400 hover:text-zinc-700 transition-colors"
      aria-label="Copy secret"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export default function WebhooksPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Create form
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);

  // Per-row state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function fetchWebhooks() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/webhooks`);
      if (!res.ok) throw new Error("Failed to load webhooks");
      const json = await res.json();
      setWebhooks(json.data);
    } catch {
      setError("Could not load webhooks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWebhooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  function toggleEvent(ev: WebhookEvent) {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || selectedEvents.length === 0) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events: selectedEvents }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message ?? "Failed to create webhook");
      }
      const json = await res.json();
      setNewSecret(json.data.secret);
      setUrl("");
      setSelectedEvents([]);
      await fetchWebhooks();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create webhook");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(webhookId: string) {
    setDeletingId(webhookId);
    try {
      await fetch(`/api/orgs/${orgId}/webhooks/${webhookId}`, { method: "DELETE" });
      setWebhooks((w) => w.filter((x) => x.id !== webhookId));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggle(webhook: Webhook) {
    setTogglingId(webhook.id);
    try {
      const res = await fetch(`/api/orgs/${orgId}/webhooks/${webhook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !webhook.enabled }),
      });
      if (res.ok) {
        setWebhooks((wh) =>
          wh.map((w) => (w.id === webhook.id ? { ...w, enabled: !w.enabled } : w)),
        );
      }
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[28px] max-w-4xl">
      <div>
        <h2 className="text-[22px] font-normal tracking-[-0.44px] text-[#111827]">
          Outbound Webhooks
        </h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          CarbonSite will POST a signed JSON payload to your endpoint when selected events occur.
          Verify deliveries using the <code className="text-xs bg-zinc-100 px-1 py-0.5 rounded">X-CarbonSite-Signature</code> header (HMAC-SHA256).
        </p>
      </div>

      {newSecret && (
        <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800 mb-2">
            Webhook created. Copy the signing secret now — it will not be shown again.
          </p>
          <div className="flex items-center gap-2 bg-white rounded border border-emerald-200 px-3 py-2">
            <Eye className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-mono text-sm flex-1 break-all">{newSecret}</span>
            <CopyButton value={newSecret} />
          </div>
          <button
            onClick={() => setNewSecret(null)}
            className="mt-2 text-xs text-emerald-700 underline underline-offset-2"
          >
            I&apos;ve saved it, dismiss
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Create form */}
      <form
        onSubmit={handleCreate}
        className="rounded-[10px] border border-[#E5E7EB] bg-[#f9fafb] p-4 flex flex-col gap-4"
      >
        <p className="text-sm font-medium text-zinc-800">Add endpoint</p>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Endpoint URL (must be HTTPS)</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-server.example.com/webhooks/carbonsite"
            className="h-8 text-sm font-mono"
            type="url"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-zinc-500">Events to subscribe to</p>
          <div className="flex flex-wrap gap-2">
            {ALL_EVENTS.map((ev) => {
              const active = selectedEvents.includes(ev);
              return (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvent(ev)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    active
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  {active && <Zap className="h-3 w-3" />}
                  {EVENT_LABELS[ev]}
                </button>
              );
            })}
          </div>
        </div>

        {createError && <p className="text-xs text-red-600">{createError}</p>}

        <div>
          <Button
            type="submit"
            size="sm"
            className="gap-1.5"
            disabled={creating || !url.trim() || selectedEvents.length === 0}
          >
            <Plus aria-hidden className="h-4 w-4" />
            {creating ? "Creating..." : "Add endpoint"}
          </Button>
        </div>
      </form>

      {/* Webhook list */}
      <div className="overflow-x-auto rounded-[10px] border border-[#E5E7EB]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#f9fafb]">
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500">
                Endpoint URL
              </th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500">Events</th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500">Secret</th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb]">
            {loading && webhooks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-zinc-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && webhooks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-400">
                  No webhooks yet. Add an endpoint above.
                </td>
              </tr>
            )}
            {webhooks.map((wh) => (
              <tr key={wh.id} className="hover:bg-[#f9fafb] transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-zinc-800 max-w-[260px] truncate">
                  {wh.url}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(wh.events as string[]).map((ev) => (
                      <Badge key={ev} variant="outline" className="text-[10px] py-0 px-1.5">
                        {ev.replace("_", " ").replace(".", " / ")}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 font-mono text-xs text-zinc-500">
                    <span>{wh.secret}</span>
                    <CopyButton value={wh.secret} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(wh)}
                    disabled={togglingId === wh.id}
                    className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 disabled:opacity-40 transition-colors"
                    aria-label={wh.enabled ? "Disable webhook" : "Enable webhook"}
                  >
                    {wh.enabled ? (
                      <>
                        <ToggleRight className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-700">Active</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-4 w-4 text-zinc-400" />
                        <span className="text-zinc-500">Disabled</span>
                      </>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(wh.id)}
                    disabled={deletingId === wh.id}
                    className="p-1.5 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    aria-label="Delete webhook"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-[10px] border border-[#E5E7EB] bg-[#f9fafb] p-4 text-sm text-zinc-600">
        <p className="font-medium text-zinc-800 mb-2">Verifying deliveries</p>
        <p className="text-xs text-zinc-500 mb-2">
          Each request includes a <code className="bg-zinc-100 px-1 rounded">X-CarbonSite-Signature</code> header.
          Verify with HMAC-SHA256:
        </p>
        <pre className="bg-zinc-900 text-zinc-100 rounded px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`const sig = crypto
  .createHmac("sha256", webhookSecret)
  .update(rawBody)
  .digest("hex");
if (sig !== req.headers["x-carbonsite-signature"]) {
  return res.status(401).end();
}`}
        </pre>
      </div>
    </div>
  );
}
