'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, Shield, AlertCircle } from 'lucide-react';

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actor: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  ipAddress: string | null;
  frameworks: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

interface AuditLogsResponse {
  logs: AuditEntry[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  approve: 'bg-emerald-100 text-emerald-800',
  reject: 'bg-orange-100 text-orange-800',
  publish: 'bg-purple-100 text-purple-800',
};

export default function AuditLogsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = Array.isArray(params.orgId) ? params.orgId[0] : params.orgId;

  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const resourceType = searchParams.get('resourceType') || '';
  const action = searchParams.get('action') || '';
  const framework = searchParams.get('framework') || '';

  useEffect(() => {
    async function fetchLogs() {
      try {
        setLoading(true);
        const query = new URLSearchParams();
        if (resourceType) query.append('resourceType', resourceType);
        if (action) query.append('action', action);
        if (framework) query.append('framework', framework);
        query.append('limit', '25');

        const response = await fetch(`/api/orgs/${orgId}/audit/logs?${query}`);
        if (!response.ok) throw new Error('Failed to fetch audit logs');

        const data: AuditLogsResponse = await response.json();
        setLogs(data.logs);
        setNextCursor(data.pagination.nextCursor);
        setHasMore(data.pagination.hasMore);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [orgId, resourceType, action, framework]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p className="mt-2 text-gray-600">Complete audit trail of all system activities</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {resourceType && (
              <Badge variant="secondary">
                Resource: {resourceType}
                <button className="ml-2">×</button>
              </Badge>
            )}
            {action && (
              <Badge variant="secondary">
                Action: {action}
                <button className="ml-2">×</button>
              </Badge>
            )}
            {framework && (
              <Badge variant="secondary">
                Framework: {framework}
                <button className="ml-2">×</button>
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-gray-600">No audit logs found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 border rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
                    <Shield className="h-4 w-4" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={actionColors[log.action] || 'bg-gray-100 text-gray-800'}>
                        {log.action}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900">
                        {log.resourceType}
                      </span>
                      <span className="text-xs text-gray-500">{log.resourceId}</span>
                    </div>

                    <p className="mt-1 text-sm text-gray-600">
                      {log.actor ? (
                        <>
                          By <strong>{log.actor.name || log.actor.email}</strong>
                        </>
                      ) : (
                        <>By <strong>System</strong></>
                      )}
                    </p>

                    {log.frameworks.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {log.frameworks.map((fw) => (
                          <Badge
                            key={fw}
                            variant="outline"
                            className="text-xs"
                          >
                            {fw}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <p className="mt-2 text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                      {log.ipAddress && ` • IP: ${log.ipAddress}`}
                    </p>
                  </div>

                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline">Load More</Button>
        </div>
      )}
    </div>
  );
}
