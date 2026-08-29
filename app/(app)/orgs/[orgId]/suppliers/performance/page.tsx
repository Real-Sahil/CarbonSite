'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus, CheckCircle, AlertCircle } from 'lucide-react';

interface SupplierPerformance {
  id: string;
  organizationId: string;
  supplierId: string;
  submissionCount: number;
  approvedCount: number;
  rejectedCount: number;
  onTimeCount: number;
  completenessScore: number;
  dataQualityScore: number;
  acceptanceRate: number;
  onTimeRate: number;
  rejectionRate: number;
  lastDataQualityTrend: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: string;
    name: string;
  };
}

interface HistoryRecord {
  id: string;
  completenessScore: number;
  dataQualityScore: number;
  submissionCount: number;
  approvedCount: number;
  recordedAt: string;
}

interface SupplierPerformanceResponse {
  performance: SupplierPerformance;
  history: HistoryRecord[];
  metrics: {
    totalSubmissions: number;
    approvedSubmissions: number;
    rejectedSubmissions: number;
    onTimeSubmissions: number;
  };
}

function getQualityBadge(score: number) {
  if (score >= 85) return { label: 'Excellent', color: 'bg-green-100 text-green-800' };
  if (score >= 70) return { label: 'Good', color: 'bg-blue-100 text-blue-800' };
  if (score >= 50) return { label: 'Fair', color: 'bg-yellow-100 text-yellow-800' };
  return { label: 'Poor', color: 'bg-red-100 text-red-800' };
}

function getTrendIcon(trend: string | null) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'declining':
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    default:
      return <Minus className="h-4 w-4 text-gray-400" />;
  }
}

interface PageProps {
  searchParams: Promise<{ supplierId?: string }>;
}

export default function SupplierPerformancePage(props: PageProps) {
  const params = useParams();
  const orgId = Array.isArray(params.orgId) ? params.orgId[0] : params.orgId;

  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [data, setData] = useState<SupplierPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveParams() {
      const searchParams = await props.searchParams;
      if (searchParams.supplierId) {
        setSupplierId(searchParams.supplierId);
      }
    }
    resolveParams();
  }, [props.searchParams]);

  useEffect(() => {
    if (!supplierId || !orgId) return;

    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/orgs/${orgId}/suppliers/${supplierId}/performance`
        );
        if (!response.ok) throw new Error('Failed to fetch performance data');
        const json = await response.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [orgId, supplierId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">Error: {error || 'Failed to load performance data'}</p>
        </div>
      </div>
    );
  }

  const { performance, history, metrics } = data;
  const qualityBadge = getQualityBadge(performance.dataQualityScore);
  const historyChartData = history
    .slice()
    .reverse()
    .map((h) => ({
      date: new Date(h.recordedAt).toLocaleDateString(),
      completeness: Math.round(h.completenessScore * 10) / 10,
      quality: Math.round(h.dataQualityScore * 10) / 10,
    }));

  const metricsChartData = [
    { name: 'Approved', value: metrics.approvedSubmissions, fill: '#10b981' },
    { name: 'Rejected', value: metrics.rejectedSubmissions, fill: '#ef4444' },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{performance.supplier.name}</h1>
        <p className="mt-2 text-gray-600">Supplier Performance Analytics</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Data Quality Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {Math.round(performance.dataQualityScore * 10) / 10}%
                </div>
                <Badge className={`mt-2 ${qualityBadge.color}`}>
                  {qualityBadge.label}
                </Badge>
              </div>
              <div>{getTrendIcon(performance.lastDataQualityTrend)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Acceptance Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(performance.acceptanceRate * 10) / 10}%
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {metrics.approvedSubmissions} of {metrics.totalSubmissions}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              On-Time Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(performance.onTimeRate * 10) / 10}%
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {metrics.onTimeSubmissions} on time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Completeness Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(performance.completenessScore * 10) / 10}%
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Average data completeness
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quality Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Trend (90 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="quality"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Quality Score"
                />
                <Line
                  type="monotone"
                  dataKey="completeness"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Completeness"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Submission Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Submission Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metricsChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {metricsChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Submission Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Submission Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-3">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-xl font-bold text-gray-900">
                  {metrics.totalSubmissions}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-xl font-bold text-gray-900">
                  {metrics.approvedSubmissions}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-xl font-bold text-gray-900">
                  {metrics.rejectedSubmissions}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-3">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">On Time</p>
                <p className="text-xl font-bold text-gray-900">
                  {metrics.onTimeSubmissions}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
