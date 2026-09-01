'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { ArrowLeft, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface WorkflowExecution {
  id: string;
  n8nExecutionId: string;
  status: string;
  triggerEvent: string;
  duration: number | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const workflowId = params.workflowId as string;

  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExecutions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/orgs/${orgId}/integrations/n8n/workflows/${workflowId}/executions`
      );
      if (!res.ok) throw new Error('Failed to fetch executions');
      const data = await res.json();
      setExecutions(data.executions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId, workflowId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchExecutions();
  }, [fetchExecutions]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'running':
        return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
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
          <h1 className="text-3xl font-bold tracking-tight">Workflow Executions</h1>
          <p className="text-muted-foreground mt-1">
            View execution history for this workflow
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
          <CardDescription>
            Recent executions of this workflow, ordered by most recent first
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading executions...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : executions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No executions yet. Workflow will appear here once triggered.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Started At</TableHead>
                    <TableHead>Completed At</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Trigger Event</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((execution) => (
                    <TableRow key={execution.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(execution.status)}
                          <Badge
                            variant={
                              execution.status === 'success'
                                ? 'default'
                                : execution.status === 'error'
                                  ? 'destructive'
                                  : 'outline'
                            }
                          >
                            {execution.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(execution.startedAt), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {execution.completedAt
                          ? format(new Date(execution.completedAt), 'MMM d, HH:mm:ss')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {execution.duration ? `${(execution.duration / 1000).toFixed(2)}s` : '-'}
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {execution.triggerEvent.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {execution.errorMessage ? (
                          <div className="max-w-xs truncate text-red-600" title={execution.errorMessage}>
                            {execution.errorMessage}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{executions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {executions.filter(e => e.status === 'success').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {executions.filter(e => e.status === 'error').length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
