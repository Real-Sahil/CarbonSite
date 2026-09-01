'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, Plus, RefreshCw } from 'lucide-react';
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

export default function AirbytePage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [connections, setConnections] = useState<AirbyteSyncConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orgs/${orgId}/integrations/airbyte/connections`);
      if (!res.ok) throw new Error('Failed to fetch connections');
      const data = await res.json();
      setConnections(data.connections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConnections();
  }, [fetchConnections]);

  const handleTestConnection = async (connectionId: string) => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/airbyte/connections/${connectionId}/test`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Test failed');
      alert('Connection test successful');
    } catch (err) {
      alert(`Test failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleManualSync = async (connectionId: string) => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/airbyte/connections/${connectionId}/sync`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Sync failed');
      alert('Sync initiated');
      fetchConnections();
    } catch (err) {
      alert(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getSyncStatusIcon = (status: string | null) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'running':
        return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Airbyte Integration</h1>
          <p className="text-muted-foreground mt-2">
            Manage data source connections and sync schedules
          </p>
        </div>
        <Button asChild>
          <a href={`/orgs/${orgId}/integrations/airbyte/new`}>
            <Plus className="w-4 h-4 mr-2" />
            New Connection
          </a>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connections.filter(c => c.enabled).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Synced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connections.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed Syncs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {connections.filter(c => c.lastSyncStatus === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Connections</CardTitle>
          <CardDescription>
            Configured Airbyte connectors syncing data to CarbonSite
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading connections...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : connections.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No connections configured yet</p>
              <Button asChild>
                <a href={`/orgs/${orgId}/integrations/airbyte/new`}>Create First Connection</a>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source System</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sync Frequency</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connections.map((conn) => (
                    <TableRow key={conn.id}>
                      <TableCell className="font-medium">
                        {conn.sourceSystem.charAt(0).toUpperCase() + conn.sourceSystem.slice(1)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSyncStatusIcon(conn.lastSyncStatus)}
                          <Badge
                            variant={
                              conn.lastSyncStatus === 'success'
                                ? 'default'
                                : conn.lastSyncStatus === 'failed'
                                  ? 'destructive'
                                  : 'outline'
                            }
                          >
                            {conn.lastSyncStatus || 'never'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{conn.syncFrequency}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {conn.lastSyncAt
                          ? format(new Date(conn.lastSyncAt), 'MMM d, HH:mm')
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestConnection(conn.id)}
                          >
                            Test
                          </Button>
                          {conn.syncFrequency === 'manual' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleManualSync(conn.id)}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                          >
                            <a href={`/orgs/${orgId}/integrations/airbyte/${conn.id}`}>Edit</a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div>
            <strong>1. Configure in Airbyte Cloud</strong>
            <p className="text-muted-foreground">
              Create a new connection in{' '}
              <a
                href="https://cloud.airbyte.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Airbyte Cloud
              </a>
              . Configure your data source (Salesforce, Stripe, Google Sheets, etc.) and set the
              destination to PostgreSQL.
            </p>
          </div>
          <div>
            <strong>2. Database Configuration</strong>
            <p className="text-muted-foreground">
              Use the CarbonSite production PostgreSQL database. Destination schema: `staged_external_data`
            </p>
          </div>
          <div>
            <strong>3. Sync Schedule</strong>
            <p className="text-muted-foreground">
              Set sync frequency (daily/weekly/manual) and enable webhook notifications for this URL:{' '}
              <code className="bg-white px-2 py-1 rounded text-xs">
                {typeof window !== 'undefined' && window.location.origin}/api/webhooks/airbyte
              </code>
            </p>
          </div>
          <div>
            <strong>4. Auto-Mapping</strong>
            <p className="text-muted-foreground">
              Synced data flows through dbt transformations and auto-populates CarbonSite activity records.
              No manual mapping required.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
