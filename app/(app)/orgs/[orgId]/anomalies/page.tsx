'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from "@/components/ui/button";

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
      return 'bg-[#F9FAFC] text-[#131d29]';
    default:
      return 'bg-[#F9FAFC] text-[#131d29]';
  }
}

function getAnomalyIcon(anomalyType: string) {
  switch (anomalyType) {
    case 'outlier':
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case 'trend_change':
      return <TrendingUp className="h-4 w-4 text-[#c2400c]" />;
    case 'unusual_pattern':
      return <TrendingDown className="h-4 w-4 text-[#c2400c]" />;
    default:
      return <Minus className="h-4 w-4 text-[#5B6A78]" />;
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
        <h1 className="text-3xl text-[#131d29]">Emission Anomalies</h1>
        <p className="mt-2 text-[#41505F]">Data quality issues and statistical outliers detected</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#41505F]">High Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums text-red-600">{highCount}</div>
            <p className="mt-1 text-xs text-[#5B6A78]">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#41505F]">Medium Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums text-yellow-600">{mediumCount}</div>
            <p className="mt-1 text-xs text-[#5B6A78]">Review recommended</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#41505F]">Low Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums text-[#c2400c]">{lowCount}</div>
            <p className="mt-1 text-xs text-[#5B6A78]">Monitor for trends</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-[#41505F]">Filter by Severity:</label>
        <Select value={severityFilter || 'all'} onValueChange={(value) => {
          setSeverityFilter(value === 'all' ? null : value);
          setOffset(0);
        }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#c2400c]" />
        </div>
      )}

      {/* Anomalies List */}
      {!loading && anomalies.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-[#5B6A78]">No anomalies detected</p>
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
                    <p className="text-xs text-[#5B6A78]">Actual Value</p>
                    <p className="text-sm font-semibold text-[#131d29]">{anomaly.value.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5B6A78]">Expected Range</p>
                    <p className="text-sm font-semibold text-[#131d29]">
                      {anomaly.expectedRange.min.toFixed(2)} — {anomaly.expectedRange.max.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5B6A78]">Deviation</p>
                    <p className="text-sm font-semibold text-red-600">{anomaly.deviation.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5B6A78]">Impact</p>
                    <p className="text-sm font-semibold text-[#131d29]">
                      {anomaly.severity === 'high' ? 'Critical' : anomaly.severity === 'medium' ? 'Moderate' : 'Minor'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <div>
                    <p className="text-xs font-medium text-[#41505F]">Issue:</p>
                    <p className="text-sm text-[#41505F]">{anomaly.message}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#41505F]">Recommendation:</p>
                    <p className="text-sm text-[#41505F]">{anomaly.recommendation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
            <p className="text-sm text-[#41505F]">
              Showing {offset + 1}–{Math.min(offset + limit, total)} of {total} anomalies
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setOffset(offset + limit)}
                disabled={!hasMore}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
