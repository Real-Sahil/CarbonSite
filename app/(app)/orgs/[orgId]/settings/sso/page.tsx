'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface SsoConfiguration {
  id: string;
  organizationId: string;
  provider: 'okta' | 'azure_ad' | 'google_workspace' | 'generic_oidc' | 'saml';
  clientId: string;
  clientSecret: string;
  metadataUrl: string;
  autoCreateUsers: boolean;
  autoAssignRole: 'admin' | 'editor' | 'reviewer' | 'viewer' | 'auditor' | 'field_worker' | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

type Provider = 'okta' | 'azure_ad' | 'google_workspace' | 'generic_oidc' | 'saml';

const PROVIDERS: { value: Provider; label: string; description: string }[] = [
  {
    value: 'okta',
    label: 'Okta',
    description: 'Okta identity platform',
  },
  {
    value: 'azure_ad',
    label: 'Azure AD',
    description: 'Microsoft Entra ID (Azure Active Directory)',
  },
  {
    value: 'google_workspace',
    label: 'Google Workspace',
    description: 'Google Cloud Identity and Access Management',
  },
  {
    value: 'generic_oidc',
    label: 'Generic OIDC',
    description: 'Any OpenID Connect provider',
  },
  {
    value: 'saml',
    label: 'SAML 2.0',
    description: 'Security Assertion Markup Language 2.0',
  },
];

const DEFAULT_ROLES = ['admin', 'editor', 'reviewer', 'viewer', 'auditor', 'field_worker'];

export default function SsoSettingsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [config, setConfig] = useState<SsoConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    provider: 'generic_oidc' as Provider,
    clientId: '',
    clientSecret: '',
    metadataUrl: '',
    autoCreateUsers: true,
    autoAssignRole: 'viewer' as const,
    enabled: false,
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/orgs/${orgId}/settings/sso`);
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
          setFormData({
            provider: data.provider,
            clientId: data.clientId,
            clientSecret: '',
            metadataUrl: data.metadataUrl,
            autoCreateUsers: data.autoCreateUsers,
            autoAssignRole: data.autoAssignRole || 'viewer',
            enabled: data.enabled,
          });
        } else if (response.status !== 404) {
          setError('Failed to load SSO configuration');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [orgId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setTestResult(null);

      const payload = {
        ...formData,
      };

      const response = await fetch(`/api/orgs/${orgId}/settings/sso`, {
        method: config ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save SSO configuration');
      }

      const updated = await response.json();
      setConfig(updated);
      setTestResult({
        success: true,
        message: 'Configuration saved successfully',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      const response = await fetch(`/api/orgs/${orgId}/settings/sso/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: formData.provider,
          metadataUrl: formData.metadataUrl,
        }),
      });

      const result = await response.json();

      setTestResult({
        success: response.ok,
        message: result.message || (response.ok ? 'Connection successful' : 'Connection failed'),
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setTesting(false);
    }
  };

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/sso/callback`;
  const signInUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in?orgId=${orgId}&ssoProvider=${formData.provider}`;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Single Sign-On (SSO)</h1>
          <p className="mt-2 text-gray-600">Configure enterprise SSO for your organization</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Single Sign-On (SSO)</h1>
        <p className="mt-2 text-gray-600">
          Enable enterprise SSO for your organization. Users will authenticate through your identity provider.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SSO Configuration</CardTitle>
          <CardDescription>
            {config
              ? `Last updated ${new Date(config.updatedAt).toLocaleDateString()}`
              : 'No SSO configuration yet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {testResult && (
            <div
              className={`flex gap-3 rounded-lg border p-4 ${
                testResult.success
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div
                className={`text-sm ${
                  testResult.success ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {testResult.message}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="provider">Identity Provider</Label>
              <Select
                value={formData.provider}
                onValueChange={(value) =>
                  setFormData({ ...formData, provider: value as Provider })
                }
              >
                <SelectTrigger id="provider" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex flex-col">
                        <span>{p.label}</span>
                        <span className="text-xs text-gray-500">{p.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-sm text-gray-600">
                Select your identity provider. Generic OIDC works with any OpenID Connect provider.
              </p>
            </div>

            <div>
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                placeholder="e.g., 0oa123abc..."
                value={formData.clientId}
                onChange={(e) =>
                  setFormData({ ...formData, clientId: e.target.value })
                }
                className="mt-2"
              />
              <p className="mt-2 text-sm text-gray-600">
                Provided by your identity provider in the application settings.
              </p>
            </div>

            <div>
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                placeholder={config ? '●●●●●●●●●●' : 'Enter client secret'}
                value={formData.clientSecret}
                onChange={(e) =>
                  setFormData({ ...formData, clientSecret: e.target.value })
                }
                className="mt-2"
              />
              <p className="mt-2 text-sm text-gray-600">
                {config
                  ? 'Leave blank to keep the current secret.'
                  : 'Keep this secret secure. Only enter here; it is encrypted in storage.'}
              </p>
            </div>

            <div>
              <Label htmlFor="metadataUrl">Metadata URL</Label>
              <Input
                id="metadataUrl"
                placeholder="e.g., https://org.okta.com/app/123/sso/saml/metadata"
                value={formData.metadataUrl}
                onChange={(e) =>
                  setFormData({ ...formData, metadataUrl: e.target.value })
                }
                className="mt-2"
              />
              <p className="mt-2 text-sm text-gray-600">
                The OpenID Connect metadata URL (e.g., /.well-known/openid-configuration) or SAML metadata endpoint.
              </p>
            </div>

            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="autoCreateUsers"
                  checked={formData.autoCreateUsers}
                  onCheckedChange={(checked: boolean) =>
                    setFormData({ ...formData, autoCreateUsers: checked })
                  }
                />
                <div className="flex-1">
                  <Label htmlFor="autoCreateUsers" className="font-medium cursor-pointer">
                    Auto-Create Users
                  </Label>
                  <p className="text-sm text-gray-600">
                    Automatically create users on their first SSO login.
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <Label htmlFor="autoAssignRole" className="font-medium">
                  Default Role for New Users
                </Label>
                <Select
                  value={formData.autoAssignRole}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      autoAssignRole: value as typeof formData.autoAssignRole,
                    })
                  }
                  disabled={!formData.autoCreateUsers}
                >
                  <SelectTrigger id="autoAssignRole" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        <span className="capitalize">{role.replace('_', ' ')}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-2 text-sm text-gray-600">
                  Role assigned to users on their first login. Can be changed later.
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="callbackUrl" className="font-medium">
                Callback URL
              </Label>
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <code className="text-sm font-mono text-gray-900">{callbackUrl}</code>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Configure this as the Redirect URI in your identity provider. Must be HTTPS in production.
              </p>
            </div>

            <div>
              <Label htmlFor="signInUrl" className="font-medium">
                Sign-in link
              </Label>
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <code className="text-sm font-mono text-gray-900 break-all">{signInUrl}</code>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Share this link with your team, or set it as the app tile URL in your
                identity provider for IdP-initiated sign-in. There is no email-domain-based
                organization lookup yet, so this link is how members reach SSO sign-in.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Checkbox
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked: boolean) =>
                  setFormData({ ...formData, enabled: checked })
                }
              />
              <div className="flex-1">
                <Label htmlFor="enabled" className="font-medium cursor-pointer">
                  Enable SSO
                </Label>
                <p className="text-sm text-gray-600">
                  When enabled, users can sign in with SSO.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-t border-gray-200 pt-6">
            <Button
              onClick={handleTest}
              variant="outline"
              disabled={!formData.metadataUrl || testing || saving}
            >
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.clientId || !formData.clientSecret || !formData.metadataUrl || saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? 'Saving...' : config ? 'Update Configuration' : 'Create Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">For Okta:</h3>
            <ol className="mt-2 space-y-2 list-decimal list-inside text-sm text-gray-600">
              <li>Log in to Okta Admin Console</li>
              <li>
                {'Create a new OIDC application: Applications > Applications > Create App Integration > OIDC'}
              </li>
              <li>Set Redirect URI to the Callback URL above</li>
              <li>Copy the Client ID and Client Secret</li>
              <li>Get the metadata URL from your Okta domain: https://your-domain.okta.com/.well-known/openid-configuration</li>
            </ol>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-semibold text-gray-900">For Azure AD:</h3>
            <ol className="mt-2 space-y-2 list-decimal list-inside text-sm text-gray-600">
              <li>Log in to Azure Portal</li>
              <li>
                {'Go to Azure Active Directory > App registrations > New registration'}
              </li>
              <li>Set Redirect URI to the Callback URL above</li>
              <li>Under Certificates &amp; secrets, create a new client secret</li>
              <li>Get the metadata URL: https://login.microsoftonline.com/your-tenant-id/v2.0/.well-known/openid-configuration</li>
            </ol>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              For additional help or SAML setup, contact support at support@metricora.co.uk
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
