'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  displayName: string;
  description: string;
  schedule: string;
  triggerType: 'scheduled' | 'event';
  enabled: boolean;
  status: 'ready' | 'not-configured';
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failed' | null;
  nextScheduledRun: string | null;
}

interface WorkflowsResponse {
  workflows: Workflow[];
  n8nConfigured: boolean;
  note: string;
}

export default function WorkflowsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [n8nConfigured, setN8nConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringWorkflow, setTriggeringWorkflow] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orgs/${orgId}/automation/workflows`);
      if (!res.ok) throw new Error('Failed to fetch workflows');

      const data: WorkflowsResponse = await res.json();
      setWorkflows(data.workflows);
      setN8nConfigured(data.n8nConfigured);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleTriggerWorkflow = async (workflowName: string) => {
    setTriggeringWorkflow(workflowName);
    try {
      const res = await fetch(`/api/orgs/${orgId}/automation/workflows/${workflowName}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to trigger workflow');
      }

      const data = await res.json();
      alert(`Workflow triggered: ${data.message || 'Successfully queued'}`);
      await fetchWorkflows();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to trigger workflow');
    } finally {
      setTriggeringWorkflow(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-100 text-green-800">Ready</Badge>;
      case 'not-configured':
        return <Badge className="bg-yellow-100 text-yellow-800">Not Configured</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automation Workflows</h1>
          <p className="text-gray-600 mt-2">
            Manage n8n workflow automation for emissions tracking and notifications
          </p>
        </div>
        <Button onClick={() => void fetchWorkflows()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {!n8nConfigured && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900">n8n Not Configured</p>
            <p className="text-sm text-yellow-800 mt-1">
              Set the N8N_WEBHOOK_URL environment variable to enable workflow automation.
              See the n8n setup documentation for details.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Error loading workflows</p>
            <p className="text-sm text-red-800 mt-1">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading workflows...</div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No workflows available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {workflow.displayName}
                      {getStatusBadge(workflow.status)}
                    </CardTitle>
                    <CardDescription className="mt-1">{workflow.description}</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleTriggerWorkflow(workflow.name)}
                    disabled={!n8nConfigured || triggeringWorkflow === workflow.name}
                    className="gap-2"
                  >
                    <Play className="w-4 h-4" />
                    {triggeringWorkflow === workflow.name ? 'Triggering...' : 'Trigger'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Trigger Type</p>
                    <p className="font-medium capitalize">{workflow.triggerType}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Schedule</p>
                    <p className="font-medium capitalize">{workflow.schedule}</p>
                  </div>
                  {workflow.lastRunAt && (
                    <div>
                      <p className="text-gray-600">Last Run</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {getStatusIcon(workflow.lastRunStatus || '')}
                        <span className="font-medium capitalize">{workflow.lastRunStatus || 'Unknown'}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(workflow.lastRunAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {workflow.nextScheduledRun && workflow.triggerType === 'scheduled' && (
                    <div>
                      <p className="text-gray-600">Next Run</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-xs">
                          {new Date(workflow.nextScheduledRun).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm">
                  <p className="font-medium text-gray-900 mb-1">Configuration</p>
                  <p className="text-gray-600">
                    {workflow.triggerType === 'scheduled'
                      ? `Runs automatically on a ${workflow.schedule} schedule`
                      : 'Triggered by system events. Manual trigger available above.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">About Automation Workflows</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-gray-700">
          <p>
            MetricOra uses n8n for low-code workflow automation. The following workflows are available:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>Field Worker Submission Reminder</strong> — Daily reminder for pending submissions
            </li>
            <li>
              <strong>Facility Risk Flagging</strong> — Identifies high-emission facilities after calculations
            </li>
            <li>
              <strong>Report Ready Notification</strong> — Notifies when reports are ready
            </li>
            <li>
              <strong>Anomaly Detection Alert</strong> — Alerts on detected data anomalies
            </li>
            <li>
              <strong>Supplier Data Request</strong> — Sends supplier data collection requests
            </li>
          </ul>
          <p className="pt-2">
            To manage workflows in detail (adding actions, conditions, formatting), visit your n8n
            instance or configure new workflows via the n8n web interface.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
