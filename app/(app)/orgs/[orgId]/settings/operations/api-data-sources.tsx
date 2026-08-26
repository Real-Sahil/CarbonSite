"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Edit2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AuthMethod = "none" | "api_key" | "bearer" | "basic";
type DataFormat = "json" | "csv";

interface ApiDataSourceRow {
  id: string;
  name: string;
  endpoint: string;
  authMethod: AuthMethod;
  dataFormat: DataFormat;
  enabled: boolean;
  lastSyncAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  syncIntervalMins: number;
}

interface Props {
  orgId: string;
  sources: ApiDataSourceRow[];
}

const selectClass = "h-9 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";

export function ApiDataSourcesPanel({ orgId, sources }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  async function requestJson(
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    payload?: Record<string, unknown>,
  ) {
    const res = await fetch(url, {
      method,
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? "Request failed");
    }
  }

  function createSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    startTransition(async () => {
      try {
        const authMethod = form.get("authMethod") as AuthMethod;
        const payload: Record<string, unknown> = {
          name: form.get("name"),
          description: form.get("description"),
          endpoint: form.get("endpoint"),
          authMethod,
          dataFormat: form.get("dataFormat"),
          syncIntervalMins: parseInt(form.get("syncIntervalMins") as string) || 60,
          mappingConfig: {},
        };

        if (authMethod === "api_key") {
          payload.apiKey = form.get("apiKey");
        } else if (authMethod === "bearer") {
          payload.bearerToken = form.get("bearerToken");
        } else if (authMethod === "basic") {
          payload.basicUsername = form.get("basicUsername");
          payload.basicPassword = form.get("basicPassword");
        }

        await requestJson(`/api/orgs/${orgId}/api-data-sources`, "POST", payload);
        formEl.reset();
        setShowForm(false);
        setSuccess("API data source created.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create data source");
      }
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="p-4">
        <h2 className="text-base font-semibold text-slate-900">API data sources</h2>
        <p className="mt-1 text-sm text-slate-500">
          Connect external APIs to automatically import activity data and emissions records.
        </p>
      </div>

      {!showForm && (
        <div className="border-t border-slate-100 px-4 py-3">
          <Button type="button" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add data source
          </Button>
        </div>
      )}

      {showForm && (
        <form onSubmit={createSource} className="border-t border-slate-100 p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium text-slate-600">Name</Label>
              <Input name="name" required maxLength={100} disabled={isPending} placeholder="e.g. Energy Provider API" />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600">Data format</Label>
              <select name="dataFormat" className={selectClass} disabled={isPending} defaultValue="json">
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-slate-600">Description</Label>
            <Textarea name="description" maxLength={500} disabled={isPending} placeholder="Optional description..." className="resize-none h-16" />
          </div>

          <div>
            <Label className="text-xs font-medium text-slate-600">API endpoint</Label>
            <Input name="endpoint" type="url" required disabled={isPending} placeholder="https://api.example.com/emissions" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium text-slate-600">Authentication</Label>
              <select name="authMethod" className={selectClass} disabled={isPending} defaultValue="none">
                <option value="none">None</option>
                <option value="api_key">API Key</option>
                <option value="bearer">Bearer token</option>
                <option value="basic">Basic auth</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600">Sync interval (minutes)</Label>
              <Input name="syncIntervalMins" type="number" min="5" max="1440" defaultValue="60" disabled={isPending} />
            </div>
          </div>

          <AuthFieldsById />

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isPending}>
              Create source
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={isPending}>
              Cancel
            </Button>
          </div>

          {success && <p className="text-sm text-green-700">{success}</p>}
          {error && <p className="whitespace-pre-line text-sm text-red-600">{error}</p>}
        </form>
      )}

      {sources.length === 0 && !showForm && (
        <div className="border-t border-slate-100 px-4 py-6 text-center text-sm text-slate-500">
          No API data sources configured.
        </div>
      )}

      {sources.length > 0 && (
        <div className="divide-y divide-slate-100">
          {sources.map((source) => (
            <ApiDataSourceRow key={source.id} orgId={orgId} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuthFieldsById() {
  const [authMethod, setAuthMethod] = useState<AuthMethod>("none");

  if (authMethod === "none") return null;

  if (authMethod === "api_key") {
    return (
      <div>
        <Label className="text-xs font-medium text-slate-600">API Key</Label>
        <Input name="apiKey" required type="password" placeholder="Enter your API key" />
      </div>
    );
  }

  if (authMethod === "bearer") {
    return (
      <div>
        <Label className="text-xs font-medium text-slate-600">Bearer token</Label>
        <Input name="bearerToken" required type="password" placeholder="Enter your bearer token" />
      </div>
    );
  }

  if (authMethod === "basic") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-xs font-medium text-slate-600">Username</Label>
          <Input name="basicUsername" required placeholder="Username" />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-600">Password</Label>
          <Input name="basicPassword" required type="password" placeholder="Password" />
        </div>
      </div>
    );
  }

  return null;
}

function ApiDataSourceRow({ orgId, source }: { orgId: string; source: ApiDataSourceRow }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeSource() {
    if (!window.confirm(`Delete "${source.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/orgs/${orgId}/api-data-sources/${source.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete source");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting source");
      setDeleting(false);
    }
  }

  const lastSync = source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleString("en-GB") : "Never";
  const hasError = source.lastErrorAt !== null;

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-slate-900">{source.name}</h3>
            {source.enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                <CheckCircle2 className="h-3 w-3" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                Disabled
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-mono break-all">{source.endpoint}</p>
          <p className="text-xs text-slate-500 mt-1">
            Syncs every {source.syncIntervalMins} min · Last sync: {lastSync}
          </p>
          {hasError && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-red-50 p-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-red-800">Sync error</p>
                <p className="text-xs text-red-700 mt-0.5">{source.lastErrorMessage}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={removeSource}
            disabled={deleting}
            className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
            aria-label={`Delete ${source.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
