'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { CheckCircle2, Clock, AlertCircle, Settings } from 'lucide-react';

interface AirbyteSyncConnection {
  id: string;
  sourceSystem: string;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  syncFrequency: string;
  createdAt: string;
}

export default function ConnectorsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [connections, setConnections] = useState<AirbyteSyncConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/orgs/${orgId}/integrations/connectors`);

      if (!response.ok) {
        throw new Error(`Failed to fetch connectors: ${response.statusText}`);
      }

      const data = await response.json();
      setConnections(data.connections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch connectors');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConnections();
  }, [fetchConnections]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="gap-1 bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3" />
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="gap-1 bg-red-100 text-red-800">
            <AlertCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="gap-1 bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-3 w-3" />
            Partial
          </Badge>
        );
      default:
        return (
          <Badge className="gap-1 bg-gray-100 text-gray-800">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Data Connectors</h1>
        <p className="text-gray-600 mt-2">
          Manage Airbyte integrations to automatically sync data from external sources
        </p>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Active Connections</CardTitle>
            <CardDescription>
              {connections.length} integration{connections.length !== 1 ? 's' : ''} configured
            </CardDescription>
          </div>
          <Button>
            <Settings className="mr-2 h-4 w-4" />
            Configure New Connection
          </Button>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : connections.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-600 mb-4">No connectors configured yet</p>
              <Button>Set Up Your First Connector</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source System</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connections.map((conn) => (
                    <TableRow key={conn.id}>
                      <TableCell className="font-medium">{conn.sourceSystem}</TableCell>
                      <TableCell>{getStatusBadge(conn.lastSyncStatus)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {conn.syncFrequency}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(conn.lastSyncAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={conn.enabled ? 'default' : 'secondary'}>
                          {conn.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          Test
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration Guide</CardTitle>
          <CardDescription>Learn how to set up Airbyte connectors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-700">
          <div>
            <h4 className="font-semibold mb-2">1. Create Airbyte Connection</h4>
            <p>
              Set up a connection in your Airbyte instance connecting your source system (Salesforce, SAP, IoT
              devices) to our PostgreSQL destination.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">2. Configure Webhook</h4>
            <p>
              In Airbyte, add a webhook notification that posts to:{' '}
              <code className="bg-gray-100 px-2 py-1 rounded">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/api/webhooks/airbyte`
                  : '/api/webhooks/airbyte'}
              </code>
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">3. Register Connection Here</h4>
            <p>Paste your Airbyte connection ID above to register and enable automatic syncing.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Supported Sources</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Salesforce (facility info, customer spend)</li>
              <li>SAP (material costs, inventory)</li>
              <li>AWS IoT Core (sensor readings, energy data)</li>
              <li>Stripe (billing and expense data)</li>
              <li>OpenWeather (location-based factors)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
