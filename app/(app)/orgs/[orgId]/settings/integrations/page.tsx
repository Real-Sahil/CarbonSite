"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, AlertCircle, Loader2, Settings } from "lucide-react";

interface IntegrationConfig {
  llmProvider: string | null;
  llmTokenValid: boolean;
  xeroConnected: boolean;
  xeroClientId: string | null;
  oidcProvider: string | null;
  oidcClientId: string | null;
  oidcIssuerUrl: string | null;
  n8nWebhookReportsTested: boolean;
  n8nWebhookSubmissionsTested: boolean;
  testResults: Record<string, { status: string; error?: string }> | null;
  lastTestedAt: string | null;
}

interface TestResult {
  status: "success" | "failed";
  error?: string;
}

export default function IntegrationsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form states
  const [llmProvider, setLlmProvider] = useState<"huggingface" | "nvidia">("huggingface");
  const [llmToken, setLlmToken] = useState("");
  const [xeroClientId, setXeroClientId] = useState("");
  const [xeroClientSecret, setXeroClientSecret] = useState("");
  const [oidcProvider, setOidcProvider] = useState<"google" | "okta" | "azure" | "generic">("generic");
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [oidcIssuerUrl, setOidcIssuerUrl] = useState("");
  const [n8nWebhookReports, setN8nWebhookReports] = useState("");
  const [n8nWebhookSubmissions, setN8nWebhookSubmissions] = useState("");

  // UI states
  const [saving, setSaving] = useState(false);
  const [testingLlm, setTestingLlm] = useState(false);
  const [testingXero, setTestingXero] = useState(false);
  const [testingOidc, setTestingOidc] = useState(false);
  const [testingN8n, setTestingN8n] = useState<"reports" | "submissions" | null>(null);

  async function fetchConfig() {
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/config`);
      if (!res.ok) throw new Error("Failed to fetch config");
      const data = await res.json();
      setConfig(data);
      if (data.llmProvider) setLlmProvider(data.llmProvider);
      if (data.xeroClientId) setXeroClientId(data.xeroClientId);
      if (data.oidcProvider) setOidcProvider(data.oidcProvider);
      if (data.oidcClientId) setOidcClientId(data.oidcClientId);
      if (data.oidcIssuerUrl) setOidcIssuerUrl(data.oidcIssuerUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function handleSaveConfig() {
    setSaving(true);
    setError("");
    try {
      const payload: any = { llmProvider };
      if (llmToken) payload.llmToken = llmToken;
      if (xeroClientId) payload.xeroClientId = xeroClientId;
      if (xeroClientSecret) payload.xeroClientSecret = xeroClientSecret;
      if (oidcProvider) payload.oidcProvider = oidcProvider;
      if (oidcClientId) payload.oidcClientId = oidcClientId;
      if (oidcClientSecret) payload.oidcClientSecret = oidcClientSecret;
      if (oidcIssuerUrl) payload.oidcIssuerUrl = oidcIssuerUrl;
      if (n8nWebhookReports) payload.n8nWebhookReports = n8nWebhookReports;
      if (n8nWebhookSubmissions) payload.n8nWebhookSubmissions = n8nWebhookSubmissions;

      const res = await fetch(`/api/orgs/${orgId}/integrations/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Failed to save config");
      }

      setLlmToken("");
      setXeroClientSecret("");
      setOidcClientSecret("");
      setN8nWebhookReports("");
      setN8nWebhookSubmissions("");
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  }

  async function testIntegration(type: "llm" | "xero" | "oidc" | "n8n", webhookType?: "reports" | "submissions") {
    try {
      if (type === "llm") setTestingLlm(true);
      if (type === "xero") setTestingXero(true);
      if (type === "oidc") setTestingOidc(true);
      if (type === "n8n") setTestingN8n(webhookType || null);

      const payload: any = { type };
      if (webhookType) payload.webhookType = webhookType;

      const res = await fetch(`/api/orgs/${orgId}/integrations/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Test failed");
      }

      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestingLlm(false);
      setTestingXero(false);
      setTestingOidc(false);
      setTestingN8n(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const testResults = config?.testResults || {};

  return (
    <div className="flex flex-col gap-[28px] max-w-4xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings className="h-5 w-5 text-zinc-600" />
          <h2 className="text-[22px] font-normal tracking-[-0.44px] text-[#111827]">Integration Settings</h2>
        </div>
        <p className="text-sm text-zinc-500 mt-0.5">
          Configure third-party services for emissions calculation, accounting, and workflow automation.
        </p>
      </div>

      {error && (
        <div className="rounded-[10px] border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* LLM Integration */}
        <div className="rounded-[10px] border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-zinc-900">AI Model Provider</h3>
            {config?.llmTokenValid && (
              <div className="flex items-center gap-1.5 text-emerald-700 text-sm">
                <CheckCircle className="h-4 w-4" />
                Connected
              </div>
            )}
            {!config?.llmTokenValid && config?.llmProvider && (
              <div className="flex items-center gap-1.5 text-amber-700 text-sm">
                <AlertCircle className="h-4 w-4" />
                Not tested
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Provider</label>
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as any)}
                  className="h-8 text-sm border border-[#E5E7EB] rounded px-2"
                >
                  <option value="huggingface">HuggingFace Inference API</option>
                  <option value="nvidia">NVIDIA NIM API</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">API Token</label>
                <Input
                  type="password"
                  value={llmToken}
                  onChange={(e) => setLlmToken(e.target.value)}
                  placeholder="Leave blank to keep existing"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => testIntegration("llm")}
              disabled={testingLlm}
              className="gap-1.5"
            >
              {testingLlm && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {!testingLlm && "Test Connection"}
            </Button>
          </div>
        </div>

        {/* Xero Integration */}
        <div className="rounded-[10px] border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-zinc-900">Xero Accounting</h3>
            {config?.xeroConnected && (
              <div className="flex items-center gap-1.5 text-emerald-700 text-sm">
                <CheckCircle className="h-4 w-4" />
                Connected
              </div>
            )}
            {!config?.xeroConnected && config?.xeroClientId && (
              <div className="flex items-center gap-1.5 text-amber-700 text-sm">
                <AlertCircle className="h-4 w-4" />
                Not tested
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Client ID</label>
                <Input
                  value={xeroClientId}
                  onChange={(e) => setXeroClientId(e.target.value)}
                  placeholder="Xero OAuth Client ID"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Client Secret</label>
                <Input
                  type="password"
                  value={xeroClientSecret}
                  onChange={(e) => setXeroClientSecret(e.target.value)}
                  placeholder="Leave blank to keep existing"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => testIntegration("xero")}
              disabled={testingXero}
              className="gap-1.5"
            >
              {testingXero && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {!testingXero && "Test Connection"}
            </Button>
          </div>
        </div>

        {/* OIDC Integration */}
        <div className="rounded-[10px] border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-zinc-900">OIDC / SSO</h3>
            {config?.oidcProvider && (
              <div className="flex items-center gap-1.5 text-emerald-700 text-sm">
                <CheckCircle className="h-4 w-4" />
                Configured
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Provider</label>
                <select
                  value={oidcProvider}
                  onChange={(e) => setOidcProvider(e.target.value as any)}
                  className="h-8 text-sm border border-[#E5E7EB] rounded px-2"
                >
                  <option value="google">Google</option>
                  <option value="okta">Okta</option>
                  <option value="azure">Azure AD</option>
                  <option value="generic">Generic OIDC</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Issuer URL</label>
                <Input
                  value={oidcIssuerUrl}
                  onChange={(e) => setOidcIssuerUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Client ID</label>
                <Input
                  value={oidcClientId}
                  onChange={(e) => setOidcClientId(e.target.value)}
                  placeholder="Client ID"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Client Secret</label>
                <Input
                  type="password"
                  value={oidcClientSecret}
                  onChange={(e) => setOidcClientSecret(e.target.value)}
                  placeholder="Leave blank to keep existing"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => testIntegration("oidc")}
              disabled={testingOidc}
              className="gap-1.5"
            >
              {testingOidc && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {!testingOidc && "Test Discovery"}
            </Button>
          </div>
        </div>

        {/* n8n Webhooks */}
        <div className="rounded-[10px] border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-zinc-900">n8n Workflow Webhooks</h3>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Reports Webhook URL</label>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  value={n8nWebhookReports}
                  onChange={(e) => setN8nWebhookReports(e.target.value)}
                  placeholder="https://n8n.example.com/webhook/reports"
                  className="h-8 text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testIntegration("n8n", "reports")}
                  disabled={testingN8n === "reports"}
                  className="gap-1"
                >
                  {testingN8n === "reports" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {testingN8n !== "reports" && config?.n8nWebhookReportsTested && <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                  {testingN8n !== "reports" && !config?.n8nWebhookReportsTested && "Test"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Submissions Webhook URL</label>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  value={n8nWebhookSubmissions}
                  onChange={(e) => setN8nWebhookSubmissions(e.target.value)}
                  placeholder="https://n8n.example.com/webhook/submissions"
                  className="h-8 text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testIntegration("n8n", "submissions")}
                  disabled={testingN8n === "submissions"}
                  className="gap-1"
                >
                  {testingN8n === "submissions" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {testingN8n !== "submissions" && config?.n8nWebhookSubmissionsTested && <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                  {testingN8n !== "submissions" && !config?.n8nWebhookSubmissionsTested && "Test"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-2">
        <Button onClick={handleSaveConfig} disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving..." : "Save All Changes"}
        </Button>
      </div>

      {config?.lastTestedAt && (
        <div className="text-xs text-zinc-500">
          Last tested: {new Date(config.lastTestedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
