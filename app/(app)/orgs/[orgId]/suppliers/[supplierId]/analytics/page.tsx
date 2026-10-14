'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, Clock } from 'lucide-react';

interface ApiResponse {
  performance: {
    submissionCount: number;
    approvedCount: number;
    rejectedCount: number;
    onTimeCount: number;
    completenessScore: number | null;
    dataQualityScore: number | null;
    lastDataQualityTrend: string | null;
  } | null;
  history: Array<Record<string, unknown>>;
  metrics: {
    totalSubmissions: number;
    approvedSubmissions: number;
    rejectedSubmissions: number;
    onTimeSubmissions: number;
    approvalRate: number;
    onTimeRate: number;
  };
}

export default function SupplierAnalyticsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const supplierId = params.supplierId as string;

  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/orgs/${orgId}/suppliers/${supplierId}/performance`);
        if (!res.ok) throw new Error('Failed to fetch supplier performance');
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [orgId, supplierId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {['submissions', 'approval', 'on-time', 'quality'].map((card) => (
            <Skeleton key={card} className="h-32 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">Failed to load supplier analytics</p>
      </div>
    );
  }

  if (!data.performance) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">No performance data available for this supplier yet.</p>
      </div>
    );
  }

  const perf = data.performance;
  const metrics = data.metrics;
  const rejectionRate = metrics.totalSubmissions > 0
    ? (metrics.rejectedSubmissions / metrics.totalSubmissions) * 100
    : 0;

  const trend = perf.lastDataQualityTrend || 'stable';
  const trendIcon = trend === 'improving' ? (
    <TrendingUp className="w-5 h-5 text-green-600" />
  ) : trend === 'declining' ? (
    <TrendingDown className="w-5 h-5 text-red-600" />
  ) : (
    <Minus className="w-5 h-5 text-[#41505F]" />
  );

  const trendLabel = trend === 'improving' ? 'Improving' : trend === 'declining' ? 'Declining' : 'Stable';
  const trendColor = trend === 'improving' ? 'text-green-700' : trend === 'declining' ? 'text-red-700' : 'text-[#41505F]';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-[#131d29]">Supplier Analytics</h1>
        <p className="mt-2 text-sm text-[#41505F]">Performance metrics and data quality trends</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#41505F] uppercase">Total Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-[#131d29]">{metrics.totalSubmissions}</p>
            <p className="mt-1 text-xs text-[#5B6A78]">All submitted records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#41505F] uppercase">Approval Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-semibold tabular-nums text-green-600">{metrics.approvalRate.toFixed(1)}%</p>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="mt-1 text-xs text-[#5B6A78]">{metrics.approvedSubmissions} approved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#41505F] uppercase">Rejection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-semibold tabular-nums text-red-600">{rejectionRate.toFixed(1)}%</p>
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="mt-1 text-xs text-[#5B6A78]">{metrics.rejectedSubmissions} rejected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#41505F] uppercase">On-Time Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-semibold tabular-nums text-[#c2400c]">{metrics.onTimeRate.toFixed(1)}%</p>
              <Clock className="w-5 h-5 text-[#c2400c]" />
            </div>
            <p className="mt-1 text-xs text-[#5B6A78]">{metrics.onTimeSubmissions} on time</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Data Quality Score</CardTitle>
            <CardDescription>Average quality of submitted records</CardDescription>
          </CardHeader>
          <CardContent>
            {perf.dataQualityScore !== null ? (
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-4xl font-semibold tabular-nums text-[#c2400c]">{Number(perf.dataQualityScore).toFixed(1)}</p>
                  <p className="mt-2 text-sm text-[#41505F]">out of 100</p>
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-[#E3E8EE]">
                    <div
                      className="h-full rounded-full bg-[#c2400c]"
                      style={{ width: `${Math.min(Number(perf.dataQualityScore), 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#5B6A78]">No data quality scores yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completeness Score</CardTitle>
            <CardDescription>Average field completeness</CardDescription>
          </CardHeader>
          <CardContent>
            {perf.completenessScore !== null ? (
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-4xl font-semibold tabular-nums text-emerald-600">{Number(perf.completenessScore).toFixed(1)}</p>
                  <p className="mt-2 text-sm text-[#41505F]">out of 100</p>
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-[#E3E8EE]">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${Math.min(Number(perf.completenessScore), 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#5B6A78]">No completeness scores yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quality Trend</CardTitle>
          <CardDescription>Recent data quality direction</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {trendIcon}
            <div>
              <p className={`text-lg font-semibold ${trendColor}`}>{trendLabel}</p>
              <p className="text-sm text-[#41505F]">
                {trend === 'improving'
                  ? 'Data quality is improving over recent submissions'
                  : trend === 'declining'
                    ? 'Data quality is declining — consider support'
                    : 'Data quality remains stable'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribution</CardTitle>
          <CardDescription>Submission status breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums text-green-600">{metrics.approvedSubmissions}</p>
              <p className="text-xs text-[#41505F] uppercase">Approved</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-red-600">{metrics.rejectedSubmissions}</p>
              <p className="text-xs text-[#41505F] uppercase">Rejected</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-yellow-600">{Math.max(0, metrics.totalSubmissions - metrics.approvedSubmissions - metrics.rejectedSubmissions)}</p>
              <p className="text-xs text-[#41505F] uppercase">Pending</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
