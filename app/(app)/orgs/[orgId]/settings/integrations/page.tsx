"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, AlertCircle, Loader2, Settings, Link2, Link2Off, RefreshCw } from "lucide-react";

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

interface OAuthConnection {
  connected: boolean;
  connectedAt?: string | null;
  accountName?: string | null;
  scopes?: string[];
  tokenExpired?: boolean;
}

export default function IntegrationsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [xeroConn, setXeroConn] = useState<OAuthConnection | null>(null);
  const [quickbooksConn, setQuickbooksConn] = useState<OAuthConnection | null>(null);
  const [sageConn, setSageConn] = useState<OAuthConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
  const [connectingXero, setConnectingXero] = useState(false);
  const [disconnectingXero, setDisconnectingXero] = useState(false);
  const [syncingXero, setSyncingXero] = useState(false);
  const [connectingQuickbooks, setConnectingQuickbooks] = useState(false);
  const [disconnectingQuickbooks, setDisconnectingQuickbooks] = useState(false);
  const [connectingSage, setConnectingSage] = useState(false);
  const [disconnectingSage, setDisconnectingSage] = useState(false);
  const [testingOidc, setTestingOidc] = useState(false);
  const [testingN8n, setTestingN8n] = useState<"reports" | "submissions" | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const [cfgRes, xeroRes, qbRes, sageRes] = await Promise.all([
        fetch(`/api/orgs/${orgId}/integrations/config`),
        fetch(`/api/orgs/${orgId}/integrations/xero`),
        fetch(`/api/orgs/${orgId}/integrations/quickbooks`),
        fetch(`/api/orgs/${orgId}/integrations/sage`),
      ]);
      if (!cfgRes.ok) throw new Error("Failed to fetch config");
      const data = await cfgRes.json();
      setConfig(data);
      if (data.llmProvider) setLlmProvider(data.llmProvider);
      if (data.xeroClientId) setXeroClientId(data.xeroClientId);
      if (data.oidcProvider) setOidcProvider(data.oidcProvider);
      if (data.oidcClientId) setOidcClientId(data.oidcClientId);
      if (data.oidcIssuerUrl) setOidcIssuerUrl(data.oidcIssuerUrl);

      if (xeroRes.ok) setXeroConn(await xeroRes.json());
      if (qbRes.ok) setQuickbooksConn(await qbRes.json());
      if (sageRes.ok) setSageConn(await sageRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    // Handle OAuth callback result from URL params
    const xeroSuccess = searchParams.get("xero_success");
    const xeroError = searchParams.get("xero_error");
    const qbSuccess = searchParams.get("quickbooks_success");
    const qbError = searchParams.get("quickbooks_error");
    const sageSuccess = searchParams.get("sage_success");
    const sageError = searchParams.get("sage_error");

    if (xeroSuccess) setSuccess("Xero connected successfully.");
    if (qbSuccess) setSuccess("QuickBooks connected successfully.");
    if (sageSuccess) setSuccess("Sage connected successfully.");

    if (xeroError) {
      const messages: Record<string, string> = {
        credentials_missing: "Xero credentials not configured. Save Client ID and Secret first.",
        token_exchange_failed: "Xero OAuth token exchange failed. Check your credentials.",
        invalid_state: "Invalid OAuth state. Please try connecting again.",
        missing_params: "OAuth callback missing required parameters.",
        unexpected_error: "An unexpected error occurred during Xero connection.",
      };
      setError(messages[xeroError] ?? `Xero connection error: ${xeroError}`);
    }
    if (qbError) {
      const messages: Record<string, string> = {
        credentials_missing: "QuickBooks credentials not configured on this server.",
        token_exchange_failed: "QuickBooks OAuth token exchange failed. Check your credentials.",
        invalid_state: "Invalid OAuth state. Please try connecting again.",
        missing_params: "OAuth callback missing required parameters.",
        unexpected_error: "An unexpected error occurred during QuickBooks connection.",
      };
      setError(messages[qbError] ?? `QuickBooks connection error: ${qbError}`);
    }
    if (sageError) {
      const messages: Record<string, string> = {
        credentials_missing: "Sage credentials not configured on this server.",
        token_exchange_failed: "Sage OAuth token exchange failed. Check your credentials.",
        invalid_state: "Invalid OAuth state. Please try connecting again.",
        missing_params: "OAuth callback missing required parameters.",
        unexpected_error: "An unexpected error occurred during Sage connection.",
      };
      setError(messages[sageError] ?? `Sage connection error: ${sageError}`);
    }
    fetchConfig();
  }, [orgId, searchParams, fetchConfig]);

  async function handleSaveConfig() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload: Record<string, unknown> = { llmProvider };
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
      setSuccess("Settings saved.");
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectXero() {
    setConnectingXero(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/xero`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to start Xero OAuth");
      // Redirect to Xero's OAuth authorization page
      window.location.href = json.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect Xero");
      setConnectingXero(false);
    }
  }

  async function handleDisconnectXero() {
    if (!confirm("Disconnect Xero? Invoice sync will stop until you reconnect.")) return;
    setDisconnectingXero(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/xero`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Failed to disconnect Xero");
      }
      setSuccess("Xero disconnected.");
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect Xero");
    } finally {
      setDisconnectingXero(false);
    }
  }

  async function handleSyncXero() {
    setSyncingXero(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/xero/sync`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Sync failed");
      setSuccess(`Xero sync complete: ${json.synced} invoices imported.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xero sync failed");
    } finally {
      setSyncingXero(false);
    }
  }

  async function handleConnectQuickbooks() {
    setConnectingQuickbooks(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/quickbooks`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to start QuickBooks OAuth");
      window.location.href = json.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect QuickBooks");
      setConnectingQuickbooks(false);
    }
  }

  async function handleDisconnectQuickbooks() {
    if (!confirm("Disconnect QuickBooks? Invoice sync will stop until you reconnect.")) return;
    setDisconnectingQuickbooks(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/quickbooks`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Failed to disconnect QuickBooks");
      }
      setSuccess("QuickBooks disconnected.");
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect QuickBooks");
    } finally {
      setDisconnectingQuickbooks(false);
    }
  }

  async function handleConnectSage() {
    setConnectingSage(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/sage`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to start Sage OAuth");
      window.location.href = json.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect Sage");
      setConnectingSage(false);
    }
  }

  async function handleDisconnectSage() {
    if (!confirm("Disconnect Sage? Invoice sync will stop until you reconnect.")) return;
    setDisconnectingSage(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/sage`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Failed to disconnect Sage");
      }
      setSuccess("Sage disconnected.");
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect Sage");
    } finally {
      setDisconnectingSage(false);
    }
  }

  async function testIntegration(type: "llm" | "oidc" | "n8n", webhookType?: "reports" | "submissions") {
    setError("");
    setSuccess("");
    try {
      if (type === "llm") setTestingLlm(true);
      if (type === "oidc") setTestingOidc(true);
      if (type === "n8n") setTestingN8n(webhookType || null);

      const payload: Record<string, unknown> = { type };
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

  const isXeroConnected = xeroConn?.connected === true;
  const isQuickbooksConnected = quickbooksConn?.connected === true;
  const isSageConnected = sageConn?.connected === true;

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

      {success && (
        <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">{success}</p>
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
                  onChange={(e) => setLlmProvider(e.target.value as "huggingface" | "nvidia")}
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
            {isXeroConnected ? (
              <div className="flex items-center gap-1.5 text-emerald-700 text-sm">
                <CheckCircle className="h-4 w-4" />
                {xeroConn?.accountName ? `Connected: ${xeroConn.accountName}` : "Connected"}
              </div>
            ) : config?.xeroClientId ? (
              <div className="flex items-center gap-1.5 text-amber-700 text-sm">
                <AlertCircle className="h-4 w-4" />
                Credentials saved, not connected
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              Enter your Xero OAuth 2.0 app credentials, save them, then click Connect to authorise
              invoice access. Invoices are used for Scope 3 spend-based anomaly detection.
            </p>

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

            <div className="flex items-center gap-2 flex-wrap">
              {!isXeroConnected ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConnectXero}
                  disabled={connectingXero || !config?.xeroClientId}
                  className="gap-1.5"
                  title={!config?.xeroClientId ? "Save your Client ID first" : undefined}
                >
                  {connectingXero ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  Connect with Xero
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSyncXero}
                    disabled={syncingXero}
                    variant="outline"
                    className="gap-1.5"
                  >
                    {syncingXero ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Sync Invoices Now
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleDisconnectXero}
                    disabled={disconnectingXero}
                    className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {disconnectingXero ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Link2Off className="h-3.5 w-3.5" />
                    )}
                    Disconnect
                  </Button>
                </>
              )}

              {isXeroConnected && xeroConn?.connectedAt && (
                <span className="text-xs text-zinc-400">
                  Connected {new Date(xeroConn.connectedAt).toLocaleDateString()}
                </span>
              )}
              {isXeroConnected && xeroConn?.tokenExpired && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Token expired - reconnect to restore sync
                </span>
              )}
            </div>
          </div>
        </div>

        {/* QuickBooks Integration */}
        <div className="rounded-[10px] border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-zinc-900">QuickBooks Online</h3>
            {isQuickbooksConnected ? (
              <div className="flex items-center gap-1.5 text-emerald-700 text-sm">
                <CheckCircle className="h-4 w-4" />
                {quickbooksConn?.accountName ? `Connected: ${quickbooksConn.accountName}` : "Connected"}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              Connect QuickBooks Online to automatically pull invoice data for Scope 3 spend-based
              anomaly detection. Requires <code>QUICKBOOKS_CLIENT_ID</code> and{" "}
              <code>QUICKBOOKS_CLIENT_SECRET</code> environment variables on the server.
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {!isQuickbooksConnected ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConnectQuickbooks}
                  disabled={connectingQuickbooks}
                  className="gap-1.5"
                >
                  {connectingQuickbooks ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  Connect with QuickBooks
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleDisconnectQuickbooks}
                    disabled={disconnectingQuickbooks}
                    className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {disconnectingQuickbooks ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Link2Off className="h-3.5 w-3.5" />
                    )}
                    Disconnect
                  </Button>
                  {quickbooksConn?.connectedAt && (
                    <span className="text-xs text-zinc-400">
                      Connected {new Date(quickbooksConn.connectedAt).toLocaleDateString()}
                    </span>
                  )}
                  {quickbooksConn?.tokenExpired && (
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Token expired - reconnect to restore sync
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sage Integration */}
        <div className="rounded-[10px] border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-zinc-900">Sage Accounting</h3>
            {isSageConnected ? (
              <div className="flex items-center gap-1.5 text-emerald-700 text-sm">
                <CheckCircle className="h-4 w-4" />
                {sageConn?.accountName ? `Connected: ${sageConn.accountName}` : "Connected"}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              Connect Sage to automatically pull invoice data for Scope 3 spend-based anomaly
              detection. Requires <code>SAGE_CLIENT_ID</code> and{" "}
              <code>SAGE_CLIENT_SECRET</code> environment variables on the server.
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {!isSageConnected ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConnectSage}
                  disabled={connectingSage}
                  className="gap-1.5"
                >
                  {connectingSage ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  Connect with Sage
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleDisconnectSage}
                    disabled={disconnectingSage}
                    className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {disconnectingSage ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Link2Off className="h-3.5 w-3.5" />
                    )}
                    Disconnect
                  </Button>
                  {sageConn?.connectedAt && (
                    <span className="text-xs text-zinc-400">
                      Connected {new Date(sageConn.connectedAt).toLocaleDateString()}
                    </span>
                  )}
                  {sageConn?.tokenExpired && (
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Token expired - reconnect to restore sync
                    </span>
                  )}
                </>
              )}
            </div>
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
                  onChange={(e) => setOidcProvider(e.target.value as "google" | "okta" | "azure" | "generic")}
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
