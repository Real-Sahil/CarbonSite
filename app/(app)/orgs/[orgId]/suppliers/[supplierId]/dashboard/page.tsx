'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SupplierPerformanceData {
  supplierId: string;
  performance: {
    submissionCount: number;
    approvedCount: number;
    rejectedCount: number;
    onTimeCount: number;
    completenessScore: number;
    dataQualityScore: number;
    trend: 'improving' | 'stable' | 'declining';
    lastUpdated: string;
  };
  statistics: {
    approvalRate: number;
    rejectionRate: number;
    onTimeRate: number;
    averageCompletenessScore: number;
    averageDataQualityScore: number;
  };
  history: Array<{
    recordedAt: string;
    completenessScore: number;
    dataQualityScore: number;
    submissionCount: number;
    approvalRate: number;
  }>;
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b'];

const trendIcon = {
  improving: <TrendingUp className="h-5 w-5 text-green-600" />,
  stable: <Minus className="h-5 w-5 text-gray-600" />,
  declining: <TrendingDown className="h-5 w-5 text-red-600" />,
};

export default function SupplierDashboardPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const supplierId = params.supplierId as string;
  const [data, setData] = useState<SupplierPerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(
          `/api/orgs/${orgId}/suppliers/${supplierId}/performance`
        );
        if (!res.ok) throw new Error('Failed to fetch supplier performance');
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [orgId, supplierId]);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading supplier performance...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-red-500">
        Error: {error || 'Failed to load data'}
      </div>
    );
  }

  const { performance, statistics, history } = data;

  const submissionDistribution = [
    {
      name: 'Approved',
      value: performance.approvedCount,
    },
    {
      name: 'Rejected',
      value: performance.rejectedCount,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Supplier Performance Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Detailed analytics for supplier submissions and data quality
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {performance.submissionCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Data Quality Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">
                {Math.round(performance.dataQualityScore)}
              </div>
              <span className="text-gray-500">/100</span>
            </div>
            <div className="mt-2 flex items-center gap-1">
              {trendIcon[performance.trend]}
              <span className="text-sm capitalize text-gray-600">
                {performance.trend}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Approval Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.round(statistics.approvalRate)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              On-Time Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.round(statistics.onTimeRate)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Quality Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Data Quality Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={[...history].reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="recordedAt" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="dataQualityScore"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Submission Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Submission Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={submissionDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }: any) =>
                    `${name}: ${value} (${Math.round((value / performance.submissionCount) * 100)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {submissionDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Completeness Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Completeness Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={[...history].reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="recordedAt" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="completenessScore"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Approval Rate Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Approval Rate Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={[...history].reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="recordedAt" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="approvalRate"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border-l-4 border-green-500 pl-4">
              <p className="text-sm text-gray-600">Approved Submissions</p>
              <p className="text-2xl font-bold">{performance.approvedCount}</p>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <p className="text-sm text-gray-600">Rejected Submissions</p>
              <p className="text-2xl font-bold">{performance.rejectedCount}</p>
            </div>
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-sm text-gray-600">On-Time Submissions</p>
              <p className="text-2xl font-bold">{performance.onTimeCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
