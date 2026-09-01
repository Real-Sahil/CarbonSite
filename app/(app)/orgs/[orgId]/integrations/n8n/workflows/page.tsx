'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Trash2, Plus, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  action: string;
  enabled: boolean;
  lastTriggeredAt: string | null;
  failureCount: number;
  lastFailureReason: string | null;
}

const TRIGGER_OPTIONS = [
  { value: 'report_ready', label: 'Report Ready' },
  { value: 'field_submission', label: 'Field Submission' },
  { value: 'import_complete', label: 'Import Complete' },
  { value: 'calculation_done', label: 'Calculation Done' },
  { value: 'manual', label: 'Manual' },
];

const ACTION_OPTIONS = [
  { value: 'send_email', label: 'Send Email' },
  { value: 'slack_notification', label: 'Slack Notification' },
  { value: 'create_jira_ticket', label: 'Create Jira Ticket' },
  { value: 'update_spreadsheet', label: 'Update Spreadsheet' },
  { value: 'custom_webhook', label: 'Custom Webhook' },
];

export default function N8nWorkflowsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    trigger: '',
    action: '',
  });

  const fetchWorkflows = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/orgs/${orgId}/integrations/n8n/workflows`
      );
      if (!response.ok) throw new Error('Failed to fetch workflows');
      const data = await response.json();
      setWorkflows(data.workflows || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  async function handleCreateWorkflow() {
    if (!newWorkflow.name.trim() || !newWorkflow.trigger || !newWorkflow.action) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch(
        `/api/orgs/${orgId}/integrations/n8n/workflows`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newWorkflow),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create workflow');
      }

      setNewWorkflow({ name: '', description: '', trigger: '', action: '' });
      await fetchWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleWorkflow(workflowId: string, enabled: boolean) {
    try {
      const response = await fetch(
        `/api/orgs/${orgId}/integrations/n8n/workflows/${workflowId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !enabled }),
        }
      );

      if (!response.ok) throw new Error('Failed to update workflow');
      await fetchWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workflow');
    }
  }

  async function handleDeleteWorkflow(workflowId: string) {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      const response = await fetch(
        `/api/orgs/${orgId}/integrations/n8n/workflows/${workflowId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) throw new Error('Failed to delete workflow');
      await fetchWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workflow');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">n8n Workflows</h1>
          <p className="text-gray-600 mt-1">
            Automate tasks and integrations with n8n workflows
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Workflow
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Workflow</DialogTitle>
              <DialogDescription>
                Set up a new automation workflow for your organization
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Workflow Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Report Ready Alert"
                  value={newWorkflow.name}
                  onChange={(e) =>
                    setNewWorkflow({ ...newWorkflow, name: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Optional description"
                  value={newWorkflow.description}
                  onChange={(e) =>
                    setNewWorkflow({
                      ...newWorkflow,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="trigger">Trigger Event *</Label>
                <Select
                  value={newWorkflow.trigger}
                  onValueChange={(value) =>
                    setNewWorkflow({ ...newWorkflow, trigger: value })
                  }
                >
                  <SelectTrigger id="trigger">
                    <SelectValue placeholder="Select trigger event" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="action">Action *</Label>
                <Select
                  value={newWorkflow.action}
                  onValueChange={(value) =>
                    setNewWorkflow({ ...newWorkflow, action: value })
                  }
                >
                  <SelectTrigger id="action">
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleCreateWorkflow}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? 'Creating...' : 'Create Workflow'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-8">
            <p className="text-gray-600 text-center">Loading workflows...</p>
          </CardContent>
        </Card>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <p className="text-gray-600 text-center">
              No workflows configured yet. Create one to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      <Badge variant={workflow.enabled ? 'default' : 'secondary'}>
                        {workflow.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    {workflow.description && (
                      <CardDescription>{workflow.description}</CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleDeleteWorkflow(workflow.id)
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Trigger</p>
                    <p className="font-medium">
                      {TRIGGER_OPTIONS.find(
                        (opt) => opt.value === workflow.trigger
                      )?.label}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Action</p>
                    <p className="font-medium">
                      {ACTION_OPTIONS.find(
                        (opt) => opt.value === workflow.action
                      )?.label}
                    </p>
                  </div>
                </div>

                {workflow.failureCount > 0 && (
                  <Alert variant="destructive">
                    <XCircle className="w-4 h-4" />
                    <AlertDescription>
                      {workflow.failureCount} failures. Last error:{' '}
                      {workflow.lastFailureReason || 'Unknown'}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-between pt-2">
                  {workflow.lastTriggeredAt ? (
                    <p className="text-xs text-gray-600">
                      Last triggered:{' '}
                      {new Date(workflow.lastTriggeredAt).toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600">Never triggered</p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant={workflow.enabled ? 'outline' : 'default'}
                      size="sm"
                      onClick={() =>
                        handleToggleWorkflow(workflow.id, workflow.enabled)
                      }
                    >
                      {workflow.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
