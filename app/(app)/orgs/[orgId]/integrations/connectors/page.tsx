'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Clock, Plus, RefreshCw, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface AirbyteConnectorStatus {
  id: string;
  name: string;
  sourceType: string;
  destinationType: 'postgresql' | 'snowflake' | 's3';
  status: 'active' | 'inactive' | 'error';
  lastSyncTime: string;
  lastSyncStatus: 'success' | 'failed' | 'syncing';
  recordsSynced: number;
  nextScheduledSync: string;
  connectionId: string;
}

const AVAILABLE_SOURCES = [
  { id: 'salesforce', name: 'Salesforce', icon: '☁️' },
  { id: 'sap', name: 'SAP', icon: '📊' },
  { id: 'quickbooks', name: 'QuickBooks', icon: '💼' },
  { id: 'xero', name: 'Xero', icon: '📈' },
  { id: 'aws_iot', name: 'AWS IoT', icon: '🔌' },
  { id: 'openweathermap', name: 'OpenWeatherMap', icon: '🌤️' },
  { id: 'stripe', name: 'Stripe', icon: '💳' },
  { id: 'slack', name: 'Slack', icon: '💬' },
];

export default function AirbyteConnectorsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [connectors, setConnectors] = useState<AirbyteConnectorStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchConnectors();
  }, [orgId]);

  const fetchConnectors = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orgs/${orgId}/integrations/airbyte/connectors`);
      if (!res.ok) throw new Error('Failed to fetch connectors');

      const data = await res.json();
      setConnectors(data.connectors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddConnector = async () => {
    if (!selectedSource) return;

    try {
      setIsCreating(true);
      const res = await fetch(`/api/orgs/${orgId}/integrations/airbyte/connectors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: selectedSource }),
      });

      if (!res.ok) throw new Error('Failed to create connector');

      const data = await res.json();
      setConnectors([...connectors, data.connector]);
      setIsModalOpen(false);
      setSelectedSource('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create connector');
    } finally {
      setIsCreating(false);
    }
  };

  const handleTestConnection = async (connectorId: string) => {
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/integrations/airbyte/connectors/${connectorId}/test`,
        { method: 'POST' }
      );

      if (!res.ok) throw new Error('Connection test failed');

      const data = await res.json();
      alert(data.message || 'Connection test successful');
      fetchConnectors();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Connection test failed');
    }
  };

  const handleManualSync = async (connectorId: string) => {
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/integrations/airbyte/connectors/${connectorId}/sync`,
        { method: 'POST' }
      );

      if (!res.ok) throw new Error('Failed to trigger sync');

      fetchConnectors();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to trigger sync');
    }
  };

  const handleDeleteConnector = async (connectorId: string) => {
    if (!confirm('Are you sure you want to delete this connector?')) return;

    try {
      const res = await fetch(
        `/api/orgs/${orgId}/integrations/airbyte/connectors/${connectorId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) throw new Error('Failed to delete connector');

      setConnectors(connectors.filter(c => c.id !== connectorId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete connector');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'syncing':
        return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Airbyte Connectors</h1>
          <p className="text-gray-600 mt-2">
            Connect 1000+ data sources to automatically sync emissions-related data
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Connector
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">{error}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Connectors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {connectors.filter(c => c.status === 'active').length}
            </div>
            <p className="text-xs text-gray-600">Of {connectors.length} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Records Synced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {connectors.reduce((sum, c) => sum + c.recordsSynced, 0).toLocaleString()}
            </div>
            <p className="text-xs text-gray-600">Across all connectors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed Syncs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {connectors.filter(c => c.lastSyncStatus === 'failed').length}
            </div>
            <p className="text-xs text-gray-600">Requiring attention</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected Sources</CardTitle>
          <CardDescription>
            Manage and monitor your data connectors
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading connectors...</div>
          ) : connectors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No connectors configured yet.</p>
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(true)}
                className="mt-4"
              >
                Add Your First Connector
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead className="text-center">Records</TableHead>
                    <TableHead>Next Sync</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connectors.map((connector) => (
                    <TableRow key={connector.id}>
                      <TableCell className="font-medium">{connector.name}</TableCell>
                      <TableCell>{getStatusBadge(connector.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(connector.lastSyncStatus)}
                          <span className="text-sm">
                            {format(new Date(connector.lastSyncTime), 'MMM d, HH:mm')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {connector.recordsSynced.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {format(new Date(connector.nextScheduledSync), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestConnection(connector.id)}
                          title="Test connection"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleManualSync(connector.id)}
                          title="Sync now"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteConnector(connector.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete connector"
                        >
                          <Trash2 className="w-4 h-4" />
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

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">About Airbyte</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-gray-700">
          <p>
            Airbyte is an open-source data integration platform that connects 1000+ data sources
            to CarbonSite. Use it to automatically sync:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Facility data from ERP systems (SAP, Oracle, NetSuite)</li>
            <li>Supplier spend data from accounting software (Xero, QuickBooks, Sage)</li>
            <li>Energy consumption from IoT platforms (AWS IoT, Azure IoT)</li>
            <li>Weather data for location-based emissions factors</li>
            <li>Customer/product data from CRM systems (Salesforce, HubSpot)</li>
          </ul>
          <p className="pt-2">
            Syncs are scheduled automatically and can be triggered manually on-demand. Each sync
            creates staging records that you can review before committing to calculations.
          </p>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Connector</DialogTitle>
            <DialogDescription>
              Select a data source to connect to CarbonSite
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a data source..." />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_SOURCES.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    <span className="flex items-center gap-2">
                      <span>{source.icon}</span>
                      {source.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-sm text-blue-900">
                You'll be prompted to enter API credentials for the selected source. Credentials
                are encrypted and stored securely.
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddConnector}
              disabled={!selectedSource || isCreating}
            >
              {isCreating ? 'Creating...' : 'Add Connector'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
