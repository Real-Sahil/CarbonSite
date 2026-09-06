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
import { AlertCircle, CheckCircle, Plus, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface N8nWorkflow {
  id: string;
  n8nWorkflowId: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  lastTriggeredAt: string | null;
  failureCount: number;
  lastFailedAt: string | null;
  createdAt: string;
}

export default function N8nPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orgs/${orgId}/integrations/n8n/workflows`);
      if (!res.ok) throw new Error('Failed to fetch workflows');
      const data = await res.json();
      setWorkflows(data.workflows || []);
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

  const handleTestWorkflow = async (workflowId: string) => {
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/integrations/n8n/workflows/${workflowId}/test`,
        {
          method: 'POST',
        }
      );
      if (!res.ok) throw new Error('Test failed');
      alert('Workflow test initiated');
    } catch (err) {
      alert(`Test failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getTriggerLabel = (trigger: string) => {
    const labels: Record<string, string> = {
      report_ready: 'Report Ready',
      field_submission: 'Field Submission',
      import_complete: 'Import Complete',
      manual: 'Manual',
    };
    return labels[trigger] || trigger;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      send_email: 'Send Email',
      slack_notification: 'Slack Notification',
      create_jira_ticket: 'Create Jira Ticket',
      update_spreadsheet: 'Update Spreadsheet',
    };
    return labels[action] || action;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">n8n Workflows</h1>
          <p className="text-muted-foreground mt-2">
            Automate tasks and notifications across your emissions tracking
          </p>
        </div>
        <Button asChild>
          <a href={`/orgs/${orgId}/integrations/n8n/new`}>
            <Plus className="w-4 h-4 mr-2" />
            New Workflow
          </a>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workflows.filter(w => w.enabled).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workflows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recent Failures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {workflows.reduce((sum, w) => sum + w.failureCount, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Triggered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {workflows.length > 0
                ? format(
                    new Date(
                      Math.max(
                        ...workflows
                          .filter(w => w.lastTriggeredAt)
                          .map(w => new Date(w.lastTriggeredAt!).getTime())
                      )
                    ),
                    'MMM d, HH:mm'
                  )
                : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation Workflows</CardTitle>
          <CardDescription>
            Configured workflows triggered by emissions events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading workflows...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : workflows.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No workflows created yet</p>
              <Button asChild>
                <a href={`/orgs/${orgId}/integrations/n8n/new`}>Create First Workflow</a>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workflow Name</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Triggered</TableHead>
                    <TableHead>Failures</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflows.map((workflow) => (
                    <TableRow key={workflow.id}>
                      <TableCell className="font-medium">{workflow.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTriggerLabel(workflow.trigger)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <Zap className="w-3 h-3 mr-1" />
                          {getActionLabel(workflow.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={workflow.enabled ? 'default' : 'outline'}>
                          {workflow.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {workflow.lastTriggeredAt
                          ? format(new Date(workflow.lastTriggeredAt), 'MMM d, HH:mm')
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {workflow.failureCount > 0 && (
                            <>
                              <AlertCircle className="w-4 h-4 text-red-600" />
                              <span className="text-red-600">{workflow.failureCount}</span>
                            </>
                          )}
                          {workflow.failureCount === 0 && (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-green-600">0</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestWorkflow(workflow.id)}
                          >
                            Test
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={`/orgs/${orgId}/integrations/n8n/${workflow.id}`}>Edit</a>
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

      <Card className="bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle className="text-base">Popular Workflows</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div>
            <strong>Report Ready Notification</strong>
            <p className="text-muted-foreground">
              Triggers: Report published. Action: Email stakeholders + Slack notification
            </p>
          </div>
          <div>
            <strong>Field Submission Alert</strong>
            <p className="text-muted-foreground">
              Triggers: New field submission. Action: Notify reviewer + create task
            </p>
          </div>
          <div>
            <strong>Import Failure Handler</strong>
            <p className="text-muted-foreground">
              Triggers: Import failed. Action: Send error report + create Jira ticket
            </p>
          </div>
          <div>
            <strong>Daily Digest</strong>
            <p className="text-muted-foreground">
              Triggers: Scheduled. Action: Email top emissions + anomalies + submission status
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div>
            <strong>1. Configure in n8n</strong>
            <p className="text-muted-foreground">
              Create automation workflows in{' '}
              <a
                href="https://n8n.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                n8n
              </a>
              . Use MetricOra webhook triggers to automate responses to emissions events.
            </p>
          </div>
          <div>
            <strong>2. Webhook URL</strong>
            <p className="text-muted-foreground">
              When creating workflows, register them in MetricOra using the n8n webhook URL provided
              during workflow setup.
            </p>
          </div>
          <div>
            <strong>3. Testing</strong>
            <p className="text-muted-foreground">
              Use the &quot;Test&quot; button to simulate a workflow trigger and verify it executes correctly.
            </p>
          </div>
          <div>
            <strong>4. Monitoring</strong>
            <p className="text-muted-foreground">
              Workflow execution logs are tracked in MetricOra. Check &quot;Last Triggered&quot; and &quot;Failures&quot; to
              monitor health.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
