"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Copy, Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
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
      className="p-1 rounded text-zinc-500 hover:text-zinc-700 transition-colors"
      aria-label="Copy key"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export default function ApiKeysPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function fetchKeys() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/api-keys`);
      if (!res.ok) throw new Error("Failed to fetch keys");
      const json = await res.json();
      setKeys(json.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message ?? "Failed to create key");
      }
      const json = await res.json();
      setNewRawKey(json.rawKey);
      setName("");
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(keyId: string) {
    setDeletingId(keyId);
    try {
      await fetch(`/api/orgs/${orgId}/api-keys/${keyId}`, { method: "DELETE" });
      setKeys((k) => k.filter((x) => x.id !== keyId));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[28px] max-w-4xl">
      <div>
        <h2 className="text-[22px] font-normal tracking-[-0.44px] text-[#111827]">API Keys</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Use API keys to authenticate requests from BI tools, automations, or integrations.
          Keys are only shown once on creation.
        </p>
      </div>

      {newRawKey && (
        <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800 mb-2">
            API key created. Copy it now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2 bg-white rounded border border-emerald-200 px-3 py-2">
            <Eye className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-mono text-sm flex-1 break-all">{newRawKey}</span>
            <CopyButton value={newRawKey} />
          </div>
          <button
            onClick={() => setNewRawKey(null)}
            className="mt-2 text-xs text-emerald-700 underline underline-offset-2"
          >
            I&apos;ve saved it, dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex items-end gap-2">
        <div className="flex flex-col gap-1 flex-1 max-w-[320px]">
          <label className="text-xs text-zinc-500">Key name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Power BI integration"
            className="h-8 text-sm"
          />
        </div>
        <Button type="submit" disabled={creating || !name.trim()} size="sm" className="gap-1.5">
          <Plus aria-hidden className="h-4 w-4" />
          Create key
        </Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-[10px] border border-[#E5E7EB]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#f9fafb]">
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500">Name</th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500">Prefix</th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500">Created</th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500">Last used</th>
              <th className="px-4 py-2.5 text-left font-normal text-xs text-zinc-500">Expires</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb]">
            {loading && keys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-zinc-500">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && keys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                  No API keys yet. Create one above.
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="hover:bg-[#f9fafb] transition-colors">
                <td className="px-4 py-2.5 font-medium text-zinc-800">{k.name}</td>
                <td className="px-4 py-2.5 font-mono text-zinc-500 text-xs">{k.prefix}...</td>
                <td className="px-4 py-2.5 text-xs text-zinc-500">
                  {new Date(k.createdAt).toLocaleDateString("en-GB")}
                </td>
                <td className="px-4 py-2.5 text-xs text-zinc-500">
                  {k.lastUsedAt
                    ? new Date(k.lastUsedAt).toLocaleDateString("en-GB")
                    : "Never"}
                </td>
                <td className="px-4 py-2.5 text-xs text-zinc-500">
                  {k.expiresAt
                    ? new Date(k.expiresAt).toLocaleDateString("en-GB")
                    : "No expiry"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => handleDelete(k.id)}
                    disabled={deletingId === k.id}
                    className="p-1.5 rounded text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    aria-label={`Delete ${k.name}`}
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
        <p className="font-medium text-zinc-800 mb-1">Using the API</p>
        <p className="text-xs text-zinc-500 mb-2">
          Authenticate REST API requests with your key in the Authorization header:
        </p>
        <pre className="bg-zinc-900 text-zinc-100 rounded px-3 py-2 text-xs font-mono overflow-x-auto">
          {`Authorization: Bearer csk_your_api_key_here`}
        </pre>
      </div>
    </div>
  );
}
