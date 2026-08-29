'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface AirbyteSyncConnection {
  id: string;
  sourceSystem: string;
  enabled: boolean;
  syncFrequency: 'daily' | 'weekly' | 'manual';
  lastSyncAt: string | null;
  lastSyncStatus: 'success' | 'failed' | 'running' | null;
  createdAt: string;
  updatedAt: string;
}

export default function ConnectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const connectionId = params.connectionId as string;

  const [connection, setConnection] = useState<AirbyteSyncConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConnection();
  }, [orgId, connectionId]);

  const fetchConnection = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/orgs/${orgId}/integrations/airbyte/connectors/${connectionId}`
      );
      if (!res.ok) throw new Error('Failed to fetch connection');
      const data = await res.json();
      // Map API response to UI state format
      const connector = data.connector || data.data;
      setConnection({
        id: connector.id,
        sourceSystem: connector.sourceSystem,
        enabled: connector.enabled,
        syncFrequency: connector.syncSchedule || 'daily',
        lastSyncAt: connector.lastSyncAt,
        lastSyncStatus: connector.lastSyncStatus,
        createdAt: connector.createdAt,
        updatedAt: connector.updatedAt
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!connection) return;
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/integrations/airbyte/connectors/${connectionId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !connection.enabled }),
        }
      );
      if (!res.ok) throw new Error('Failed to update');
      fetchConnection();
    } catch (err) {
      alert(`Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading) return <div className="py-8 text-center">Loading...</div>;
  if (error) return <div className="py-8 text-center text-red-600">{error}</div>;
  if (!connection) return <div className="py-8 text-center">Connection not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight capitalize">
              {connection.sourceSystem}
            </h1>
            <p className="text-muted-foreground mt-1">
              Configured {format(new Date(connection.createdAt), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <Badge variant={connection.enabled ? 'default' : 'outline'}>
          {connection.enabled ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {connection.lastSyncStatus === 'success' && (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-600">Success</span>
                </>
              )}
              {connection.lastSyncStatus === 'failed' && (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-600">Failed</span>
                </>
              )}
              {connection.lastSyncStatus === 'running' && (
                <>
                  <Clock className="w-5 h-5 text-blue-600 animate-spin" />
                  <span className="text-blue-600">Running</span>
                </>
              )}
              {!connection.lastSyncStatus && <span className="text-muted-foreground">Never</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sync Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg capitalize font-semibold">{connection.syncFrequency}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Synced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {connection.lastSyncAt
                ? format(new Date(connection.lastSyncAt), 'MMM d, HH:mm')
                : 'Never'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {format(new Date(connection.updatedAt), 'MMM d, HH:mm')}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Enable Sync</p>
              <p className="text-sm text-muted-foreground">
                Controls whether this connection will sync data
              </p>
            </div>
            <Button
              variant={connection.enabled ? 'default' : 'outline'}
              onClick={handleToggleEnabled}
            >
              {connection.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">About This Connection</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div>
            <strong>Source System:</strong> {connection.sourceSystem}
          </div>
          <div>
            <strong>Sync Type:</strong> Recurring{' '}
            <span className="capitalize">({connection.syncFrequency})</span>
          </div>
          <div>
            <strong>Data Destination:</strong> PostgreSQL database
            <code className="block text-xs bg-white px-2 py-1 rounded mt-1">
              staged_external_data
            </code>
          </div>
          <div>
            <strong>Auto-Processing:</strong> Synced data flows through dbt transformations and
            automatically populates activity records
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
