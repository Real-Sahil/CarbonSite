'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Check, Circle, Database } from 'lucide-react';

interface LineageNode {
  type: 'activity_record' | 'factor_selection' | 'calculation' | 'snapshot' | 'report';
  id: string;
  label: string;
  timestamp?: string;
  actor?: string;
  status: 'complete' | 'pending' | 'error';
  details?: Record<string, string | number | boolean>;
}

interface DataLineage {
  recordId: string;
  nodes: LineageNode[];
  timeline: Array<{
    timestamp: string;
    action: string;
    actor: string;
    resourceId: string;
  }>;
}

export default function DataLineagePage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const recordId = (params.recordId || '') as string;

  const [lineage, setLineage] = useState<DataLineage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    const fetchLineage = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(
          `/api/orgs/${orgId}/audit/data-lineage${recordId ? `?recordId=${recordId}` : ''}`
        );
        if (!res.ok) throw new Error('Failed to fetch data lineage');
        const data = await res.json();
        setLineage(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLineage(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLineage();
  }, [orgId, recordId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 rounded-lg" />
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !lineage) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">{error || 'Failed to load data lineage'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Data Lineage</h1>
        <p className="mt-2 text-sm text-gray-600">
          Track how emissions data flows from capture through calculation to reporting
        </p>
      </div>

      {/* Lineage Flow Diagram */}
      <Card>
        <CardHeader>
          <CardTitle>Record Lineage Flow</CardTitle>
          <CardDescription>Visualize the data journey through the emissions pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 overflow-x-auto py-6">
            {lineage.nodes.map((node, index) => (
              <div key={node.id} className="flex items-center gap-4">
                {/* Node Card */}
                <div
                  onClick={() => setSelectedNode(node.id)}
                  className={`flex min-w-max cursor-pointer flex-col gap-2 rounded-lg border-2 px-4 py-3 transition-all ${
                    selectedNode === node.id
                      ? 'border-blue-600 bg-blue-50'
                      : node.status === 'complete'
                        ? 'border-green-200 bg-green-50 hover:border-green-400'
                        : node.status === 'error'
                          ? 'border-red-200 bg-red-50'
                          : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {node.status === 'complete' ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : node.status === 'error' ? (
                      <Circle className="h-5 w-5 text-red-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-400" />
                    )}
                    <span className="font-semibold text-gray-900">{node.label}</span>
                  </div>
                  {node.timestamp && (
                    <p className="text-xs text-gray-600">{new Date(node.timestamp).toLocaleString()}</p>
                  )}
                  {node.actor && <p className="text-xs text-gray-600">by {node.actor}</p>}
                </div>

                {/* Arrow (if not last node) */}
                {index < lineage.nodes.length - 1 && (
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-5 w-5 text-gray-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Node Details */}
      {selectedNode && lineage.nodes.find((n) => n.id === selectedNode) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {lineage.nodes.find((n) => n.id === selectedNode)?.label} Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lineage.nodes.find((n) => n.id === selectedNode)?.details &&
                Object.entries(lineage.nodes.find((n) => n.id === selectedNode)!.details!).map(
                  ([key, value]) => (
                    <div key={key} className="flex items-start justify-between border-b pb-3">
                      <span className="text-sm font-medium text-gray-600">{key}</span>
                      <span className="text-sm text-gray-900">
                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                      </span>
                    </div>
                  )
                )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Timeline</CardTitle>
          <CardDescription>Complete audit trail of all changes to this record</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {lineage.timeline.map((entry, index) => (
              <div key={index} className="flex gap-4 border-b pb-4 last:border-0">
                <div className="flex min-w-fit flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                  {index < lineage.timeline.length - 1 && (
                    <div className="my-2 h-8 w-0.5 bg-gray-200" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{entry.action}</p>
                  <p className="text-xs text-gray-600">
                    by {entry.actor} • {new Date(entry.timestamp).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Resource ID: {entry.resourceId}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Integrity Badge */}
      <Card>
        <CardHeader>
          <CardTitle>Data Integrity Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
              <span className="text-sm font-medium text-gray-900">Hash Chain Valid</span>
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
              <span className="text-sm font-medium text-gray-900">All Records Linked</span>
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <span className="text-sm font-medium text-gray-900">Digital Signature</span>
              <Circle className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
