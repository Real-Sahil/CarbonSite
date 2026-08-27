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
  TableRow,
} from '@/components/ui/table';
import { Zap, AlertCircle } from 'lucide-react';

interface Workflow {
  id: string;
  n8nWorkflowId: string;
  name: string;
  triggerType: string;
  description?: string;
  enabled: boolean;
  executionCount: number;
  createdAt: string;
  updatedAt: string;
}

const triggerTypeLabels: Record<string, string> = {
  field_submission_pending: 'Field Submission Pending',
  emission_threshold_reached: 'Emission Threshold Reached',
  report_ready: 'Report Ready',
  daily_digest: 'Daily Digest',
};

export default function WorkflowsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/orgs/${orgId}/workflows`);

      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.statusText}`);
      }

      const data = await response.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workflows');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchWorkflows();
  }, [fetchWorkflows]);

  const toggleWorkflow = async (workflowId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/orgs/${orgId}/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update workflow');
      }

      setWorkflows((prev) =>
        prev.map((w) => (w.id === workflowId ? { ...w, enabled: !enabled } : w))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workflow');
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      const response = await fetch(`/api/orgs/${orgId}/workflows/${workflowId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete workflow');
      }

      setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workflow');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Workflow Automation</h1>
        <p className="text-gray-600 mt-2">
          Configure n8n workflows to automate tasks like notifications, data transformations, and approvals
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
            <CardTitle>Active Workflows</CardTitle>
            <CardDescription>
              {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} configured
            </CardDescription>
          </div>
          <Button>
            <Zap className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-600 mb-4">No workflows configured yet</p>
              <Button>Set Up Your First Workflow</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workflow Name</TableHead>
                    <TableHead>Trigger Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Executions</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflows.map((workflow) => (
                    <TableRow key={workflow.id}>
                      <TableCell className="font-medium">{workflow.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {triggerTypeLabels[workflow.triggerType] || workflow.triggerType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={workflow.enabled ? 'default' : 'secondary'}>
                          {workflow.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {workflow.executionCount} run{workflow.executionCount !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(workflow.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleWorkflow(workflow.id, workflow.enabled)}
                        >
                          {workflow.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteWorkflow(workflow.id)}
                        >
                          Delete
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
          <CardTitle>Available Triggers</CardTitle>
          <CardDescription>Workflows can be triggered by these events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-2">Field Submission Pending</h4>
              <p className="text-sm text-gray-600">
                Triggered when field submissions exceed 7 days pending. Useful for sending reminder emails to reviewers.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-2">Emission Threshold Reached</h4>
              <p className="text-sm text-gray-600">
                Triggered when a facility emissions exceed configured threshold. Useful for alerts and escalations.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-2">Report Ready</h4>
              <p className="text-sm text-gray-600">
                Triggered when reports complete generation. Useful for sending reports and slack notifications.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-2">Daily Digest</h4>
              <p className="text-sm text-gray-600">
                Triggered daily at configured time. Useful for sending daily summaries and dashboards.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
