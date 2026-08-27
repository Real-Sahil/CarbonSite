"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

type SsoProvider = "okta" | "azure_ad" | "google_workspace" | "generic_oidc" | "saml";

interface SsoConfiguration {
  id: string;
  enabled: boolean;
  provider: SsoProvider;
  metadataUrl?: string;
  clientId: string;
  idpEntityId?: string;
  ssoUrl?: string;
  autoCreateUsers: boolean;
  autoAssignRole?: string;
  requireMfa: boolean;
  syncAttributes: boolean;
  createdAt: string;
}

interface SsoSession {
  id: string;
  userId: string;
  provider: string;
  lastActivityAt: string;
  createdAt: string;
}

export default function SsoSettingsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [provider, setProvider] = useState<SsoProvider>("okta");
  const [showSecrets, setShowSecrets] = useState(false);
  const [config, setConfig] = useState<SsoConfiguration | null>(null);
  const [sessions, setSessions] = useState<SsoSession[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchConfig = async () => {
    try {
      const r = await fetch(`/api/orgs/${orgId}/sso/configuration`);
      if (r.ok) {
        const data = await r.json() as SsoConfiguration;
        setConfig(data);
      }
    } catch (err) {
      console.error("Failed to fetch config", err instanceof Error ? err.message : String(err));
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const r = await fetch(`/api/orgs/${orgId}/sso/sessions`);
      if (r.ok) {
        const data = await r.json() as SsoSession[];
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed to fetch sessions", err instanceof Error ? err.message : String(err));
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const r = await fetch(`/api/orgs/${orgId}/sso/configuration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, enabled: true }),
      });
      if (r.ok) {
        await fetchConfig();
      }
    } catch (err) {
      console.error("Failed to save config", err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const r = await fetch(`/api/orgs/${orgId}/sso/test`, { method: "POST" });
      const data = await r.json() as { success: boolean; message: string };
      setTestResult(data);
    } catch (err) {
      console.error("Test failed", err instanceof Error ? err.message : String(err));
      setTestResult({ success: false, message: "Test failed" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const r = await fetch(`/api/orgs/${orgId}/sso/sessions/${sessionId}`, { method: "DELETE" });
      if (r.ok) {
        await fetchSessions();
      }
    } catch (err) {
      console.error("Failed to revoke session", err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchConfig(), fetchSessions()]);
    };
    load();
  }, [orgId]);

  const renderProviderFields = () => {
    switch (provider) {
      case "okta":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="metadataUrl">Okta Metadata URL</Label>
              <Input
                id="metadataUrl"
                placeholder="https://your-org.okta.com/.well-known/openid-configuration"
                type="url"
              />
              <p className="text-xs text-gray-500">
                Found in Okta Admin → Security → API → Authorization Servers
              </p>
            </div>
          </>
        );

      case "azure_ad":
        return (
          <div className="space-y-2">
            <Label htmlFor="metadataUrl">Azure AD Metadata URL</Label>
            <Input
              id="metadataUrl"
              placeholder="https://login.microsoftonline.com/{tenant-id}/.well-known/openid-configuration"
              type="url"
            />
            <p className="text-xs text-gray-500">
              Found in Azure Portal → App Registrations → Endpoints
            </p>
          </div>
        );

      case "google_workspace":
        return null;

      case "generic_oidc":
        return (
          <div className="space-y-2">
            <Label htmlFor="metadataUrl">OIDC Discovery URL</Label>
            <Input
              id="metadataUrl"
              placeholder="https://your-provider.com/.well-known/openid-configuration"
              type="url"
            />
            <p className="text-xs text-gray-500">
              Usually available at /.well-known/openid-configuration on your provider
            </p>
          </div>
        );

      case "saml":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="idpEntityId">IdP Entity ID</Label>
              <Input id="idpEntityId" placeholder="urn:example:idp" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssoUrl">SSO URL</Label>
              <Input id="ssoUrl" placeholder="https://idp.example.com/sso" type="url" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="certificateX509">X.509 Certificate</Label>
              <textarea
                id="certificateX509"
                placeholder="-----BEGIN CERTIFICATE-----&#10;MIIC...&#10;-----END CERTIFICATE-----"
                className="w-full border rounded px-3 py-2 font-mono text-xs min-h-[120px]"
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Single Sign-On (SSO)</h1>
        <p className="text-gray-600 mt-2">
          Configure enterprise identity provider for your organization members
        </p>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>SSO Configuration</CardTitle>
          <CardDescription>
            {config ? "Update your SSO settings" : "Set up SSO for your organization"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label htmlFor="provider">Identity Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as SsoProvider)}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="okta">Okta</SelectItem>
                <SelectItem value="azure_ad">Azure Active Directory</SelectItem>
                <SelectItem value="google_workspace">Google Workspace</SelectItem>
                <SelectItem value="generic_oidc">Generic OIDC</SelectItem>
                <SelectItem value="saml">SAML 2.0</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Client Credentials */}
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input id="clientId" placeholder="Client ID from your provider" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <div className="flex gap-2">
              <Input
                id="clientSecret"
                type={showSecrets ? "text" : "password"}
                placeholder="••••••••••••••••"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSecrets(!showSecrets)}
              >
                {showSecrets ? "Hide" : "Show"}
              </Button>
            </div>
            <p className="text-xs text-gray-500">Never share this secret. Store it securely.</p>
          </div>

          {/* Provider-Specific Fields */}
          {renderProviderFields()}

          {/* Provisioning Settings */}
          <div className="border-t pt-6 space-y-6">
            <h3 className="font-semibold">Provisioning & Security</h3>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autoCreate">Auto-Create Users</Label>
                <p className="text-xs text-gray-500">
                  Automatically create user accounts for new SSO users
                </p>
              </div>
              <Checkbox id="autoCreate" defaultChecked={config?.autoCreateUsers} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="autoRole">Auto-Assign Role</Label>
              <Select defaultValue={config?.autoAssignRole || "viewer"}>
                <SelectTrigger id="autoRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Manual assignment)</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="auditor">Auditor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Default role assigned to newly provisioned users
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="requireMfa">Require MFA</Label>
                <p className="text-xs text-gray-500">Require multi-factor authentication</p>
              </div>
              <Checkbox id="requireMfa" defaultChecked={config?.requireMfa} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="syncAttributes">Sync Profile Attributes</Label>
                <p className="text-xs text-gray-500">
                  Keep user name/picture synchronized with provider
                </p>
              </div>
              <Checkbox id="syncAttributes" defaultChecked={config?.syncAttributes} />
            </div>
          </div>

          {/* Status and Actions */}
          <div className="border-t pt-6 space-y-4">
            {config && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  SSO is {config.enabled ? "enabled" : "disabled"} for {config.provider}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleSaveConfig}
                disabled={isSaving}
              >
                {isSaving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Configuration
              </Button>

              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
              >
                {isTesting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Test Connection
              </Button>
            </div>

            {testResult && testResult.success && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}

            {testResult && !testResult.success && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {testResult.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Active SSO Sessions</CardTitle>
          <CardDescription>
            {sessions && sessions.length > 0
              ? `${sessions.length} user${sessions.length !== 1 ? "s" : ""} currently logged in via SSO`
              : "No active SSO sessions"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          ) : sessions && sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((session: SsoSession) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div>
                    <Badge variant="outline" className="mb-2">
                      {session.provider}
                    </Badge>
                    <p className="text-sm text-gray-600">
                      Last active: {new Date(session.lastActivityAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevokeSession(session.id)}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No active sessions</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
