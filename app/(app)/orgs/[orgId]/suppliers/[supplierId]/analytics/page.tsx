'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, Clock } from 'lucide-react';

interface SupplierPerformance {
  performance: {
    submissionCount: number;
    approvedCount: number;
    rejectedCount: number;
    onTimeCount: number;
    approvalRate: number;
    rejectionRate: number;
    onTimeRate: number;
    scores: {
      completenessScore: number | null;
      dataQualityScore: number | null;
    };
    trend: string | null;
  };
}

export default function SupplierAnalyticsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const supplierId = params.supplierId as string;

  const [data, setData] = useState<SupplierPerformance | null>(null);
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
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
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

  const perf = data.performance;
  const trendIcon = perf.trend === 'improving' ? (
    <TrendingUp className="w-5 h-5 text-green-600" />
  ) : perf.trend === 'declining' ? (
    <TrendingDown className="w-5 h-5 text-red-600" />
  ) : (
    <Minus className="w-5 h-5 text-gray-600" />
  );

  const trendLabel = perf.trend === 'improving' ? 'Improving' : perf.trend === 'declining' ? 'Declining' : 'Stable';
  const trendColor = perf.trend === 'improving' ? 'text-green-700' : perf.trend === 'declining' ? 'text-red-700' : 'text-gray-700';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Supplier Analytics</h1>
        <p className="mt-2 text-sm text-gray-600">Performance metrics and data quality trends</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 uppercase">Total Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{perf.submissionCount}</p>
            <p className="mt-1 text-xs text-gray-500">All submitted records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 uppercase">Approval Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-green-600">{perf.approvalRate.toFixed(1)}%</p>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="mt-1 text-xs text-gray-500">{perf.approvedCount} approved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 uppercase">Rejection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-red-600">{perf.rejectionRate.toFixed(1)}%</p>
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="mt-1 text-xs text-gray-500">{perf.rejectedCount} rejected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 uppercase">On-Time Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-blue-600">{perf.onTimeRate.toFixed(1)}%</p>
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <p className="mt-1 text-xs text-gray-500">{perf.onTimeCount} on time</p>
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
            {perf.scores.dataQualityScore !== null ? (
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-4xl font-bold text-blue-600">{perf.scores.dataQualityScore.toFixed(1)}</p>
                  <p className="mt-2 text-sm text-gray-600">out of 100</p>
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${Math.min(perf.scores.dataQualityScore, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No data quality scores yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completeness Score</CardTitle>
            <CardDescription>Average field completeness</CardDescription>
          </CardHeader>
          <CardContent>
            {perf.scores.completenessScore !== null ? (
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-4xl font-bold text-emerald-600">{perf.scores.completenessScore.toFixed(1)}</p>
                  <p className="mt-2 text-sm text-gray-600">out of 100</p>
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${Math.min(perf.scores.completenessScore, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No completeness scores yet</p>
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
              <p className="text-sm text-gray-600">
                {perf.trend === 'improving'
                  ? 'Data quality is improving over recent submissions'
                  : perf.trend === 'declining'
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
              <p className="text-2xl font-bold text-green-600">{perf.approvedCount}</p>
              <p className="text-xs text-gray-600 uppercase">Approved</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{perf.rejectedCount}</p>
              <p className="text-xs text-gray-600 uppercase">Rejected</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{Math.max(0, perf.submissionCount - perf.approvedCount - perf.rejectedCount)}</p>
              <p className="text-xs text-gray-600 uppercase">Pending</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
