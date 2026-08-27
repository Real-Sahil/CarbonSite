'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface EmissionAnomaly {
  recordId: string;
  category: string;
  anomalyType: 'outlier' | 'trend_change' | 'unusual_pattern';
  severity: 'low' | 'medium' | 'high';
  value: number;
  expectedRange: {
    min: number;
    max: number;
  };
  deviation: number;
  message: string;
  recommendation: string;
}

interface AnomaliesResponse {
  success: boolean;
  data: EmissionAnomaly[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getAnomalyIcon(anomalyType: string) {
  switch (anomalyType) {
    case 'outlier':
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case 'trend_change':
      return <TrendingUp className="h-4 w-4 text-purple-600" />;
    case 'unusual_pattern':
      return <TrendingDown className="h-4 w-4 text-blue-600" />;
    default:
      return <Minus className="h-4 w-4 text-gray-400" />;
  }
}

export default function AnomaliesPage() {
  const params = useParams();
  const orgId = Array.isArray(params.orgId) ? params.orgId[0] : params.orgId;
  const [anomalies, setAnomalies] = useState<EmissionAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const limit = 25;

  useEffect(() => {
    async function fetchAnomalies() {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: offset.toString(),
        });

        if (severityFilter) {
          params.append('severity', severityFilter);
        }

        const response = await fetch(`/api/orgs/${orgId}/anomalies?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch anomalies');

        const json = (await response.json()) as AnomaliesResponse;
        setAnomalies(json.data);
        setTotal(json.pagination.total);
        setHasMore(json.pagination.hasMore);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchAnomalies();
  }, [orgId, offset, severityFilter, limit]);

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </div>
    );
  }

  const highCount = anomalies.filter(a => a.severity === 'high').length;
  const mediumCount = anomalies.filter(a => a.severity === 'medium').length;
  const lowCount = anomalies.filter(a => a.severity === 'low').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Emission Anomalies</h1>
        <p className="mt-2 text-gray-600">Data quality issues and statistical outliers detected</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">High Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{highCount}</div>
            <p className="mt-1 text-xs text-gray-500">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Medium Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{mediumCount}</div>
            <p className="mt-1 text-xs text-gray-500">Review recommended</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Low Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{lowCount}</div>
            <p className="mt-1 text-xs text-gray-500">Monitor for trends</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Filter by Severity:</label>
        <Select value={severityFilter || ''} onValueChange={(value) => {
          setSeverityFilter(value || null);
          setOffset(0);
        }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Severities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Anomalies List */}
      {!loading && anomalies.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">No anomalies detected</p>
          </CardContent>
        </Card>
      )}

      {!loading && anomalies.length > 0 && (
        <div className="space-y-4">
          {anomalies.map((anomaly) => (
            <Card key={`${anomaly.recordId}-${anomaly.anomalyType}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getAnomalyIcon(anomaly.anomalyType)}
                    <div>
                      <CardTitle className="text-base">{anomaly.category}</CardTitle>
                      <CardDescription className="mt-1">
                        {anomaly.anomalyType.replace(/_/g, ' ')} — Record ID: {anomaly.recordId.slice(0, 8)}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={getSeverityColor(anomaly.severity)}>
                    {anomaly.severity.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-gray-500">Actual Value</p>
                    <p className="text-sm font-semibold text-gray-900">{anomaly.value.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Expected Range</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {anomaly.expectedRange.min.toFixed(2)} — {anomaly.expectedRange.max.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Deviation</p>
                    <p className="text-sm font-semibold text-red-600">{anomaly.deviation.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Impact</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {anomaly.severity === 'high' ? 'Critical' : anomaly.severity === 'medium' ? 'Moderate' : 'Minor'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <div>
                    <p className="text-xs font-medium text-gray-700">Issue:</p>
                    <p className="text-sm text-gray-600">{anomaly.message}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-700">Recommendation:</p>
                    <p className="text-sm text-gray-600">{anomaly.recommendation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t pt-6">
            <p className="text-sm text-gray-600">
              Showing {offset + 1}–{Math.min(offset + limit, total)} of {total} anomalies
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={!hasMore}
                className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
