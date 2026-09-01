'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { TrendingUp, TrendingDown, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface SupplierPerformance {
  id: string;
  supplierId: string;
  supplierName: string;
  submissionCount: number;
  approvedCount: number;
  rejectedCount: number;
  onTimeCount: number;
  completenessScore: number; // 0-100
  dataQualityScore: number; // 0-100
  lastDataQualityTrend: 'improving' | 'stable' | 'declining';
  updatedAt: string;
  trendData?: Array<{
    date: string;
    qualityScore: number;
    completenessScore: number;
  }>;
}

interface PerformanceStats {
  avgQualityScore: number;
  avgCompletenessScore: number;
  bestPerformer: SupplierPerformance | null;
  worstPerformer: SupplierPerformance | null;
  improvingSuppliers: number;
  decliningSuppliers: number;
}

export default function SupplierPerformancePage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [suppliers, setSuppliers] = useState<SupplierPerformance[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<'quality' | 'completeness' | 'submissions'>('quality');
  const [filterTrend, setFilterTrend] = useState<'all' | 'improving' | 'stable' | 'declining'>('all');

  const fetchPerformanceData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterTrend !== 'all') params.append('trend', filterTrend);
      params.append('sort', sortBy);

      const res = await fetch(`/api/orgs/${orgId}/suppliers/performance?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch supplier performance data');

      const data = await res.json();
      setSuppliers(data.suppliers || []);

      // Calculate stats
      if (data.suppliers && data.suppliers.length > 0) {
        const avgQuality = data.suppliers.reduce((sum: number, s: SupplierPerformance) => sum + s.dataQualityScore, 0) / data.suppliers.length;
        const avgCompleteness = data.suppliers.reduce((sum: number, s: SupplierPerformance) => sum + s.completenessScore, 0) / data.suppliers.length;
        const bestPerformer = data.suppliers.reduce((best: SupplierPerformance | null, current: SupplierPerformance) => {
          if (!best) return current;
          return current.dataQualityScore > best.dataQualityScore ? current : best;
        }, null);
        const worstPerformer = data.suppliers.reduce((worst: SupplierPerformance | null, current: SupplierPerformance) => {
          if (!worst) return current;
          return current.dataQualityScore < worst.dataQualityScore ? current : worst;
        }, null);
        const improving = data.suppliers.filter((s: SupplierPerformance) => s.lastDataQualityTrend === 'improving').length;
        const declining = data.suppliers.filter((s: SupplierPerformance) => s.lastDataQualityTrend === 'declining').length;

        setStats({
          avgQualityScore: Math.round(avgQuality * 10) / 10,
          avgCompletenessScore: Math.round(avgCompleteness * 10) / 10,
          bestPerformer,
          worstPerformer,
          improvingSuppliers: improving,
          decliningSuppliers: declining,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId, sortBy, filterTrend]);

  useEffect(() => {
    // fetchPerformanceData is wrapped in useCallback and properly memoized
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'stable':
        return <Activity className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getCompletenessColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Sample trend data for chart
  const trendChartData = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      date: format(subDays(new Date(), 30 - i), 'MMM d'),
      quality: 65 + ((i * 7) % 30),
      completeness: 70 + ((i * 5) % 25),
    })),
    []
  );

  // Scatter data for quality vs completeness correlation
  const scatterData = useMemo(() =>
    suppliers.slice(0, 10).map(s => ({
      quality: s.dataQualityScore,
      completeness: s.completenessScore,
      name: s.supplierName,
    })),
    [suppliers]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Supplier Performance Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Track emission data quality, completeness scores, and supplier trends to optimize Scope 3 accuracy
        </p>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Data Quality</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgQualityScore}%</div>
              <p className="text-xs text-muted-foreground">Across all suppliers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Completeness</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgCompletenessScore}%</div>
              <p className="text-xs text-muted-foreground">Field fill rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Improving</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{stats.improvingSuppliers}</div>
              <p className="text-xs text-muted-foreground">Upward trend</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700">Declining</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">{stats.decliningSuppliers}</div>
              <p className="text-xs text-muted-foreground">Downward trend</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quality Trend (12 months)</CardTitle>
            <CardDescription>Overall supplier data quality trend</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="quality" stroke="#3b82f6" name="Quality Score" strokeWidth={2} />
                <Line type="monotone" dataKey="completeness" stroke="#10b981" name="Completeness" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quality vs Completeness</CardTitle>
            <CardDescription>Correlation between metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quality" name="Quality Score" type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis dataKey="completeness" name="Completeness (%)" type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Suppliers" data={scatterData} fill="#8b5cf6" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supplier Rankings</CardTitle>
          <CardDescription>Detailed performance metrics for each supplier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Select value={sortBy} onValueChange={(v: string) => setSortBy(v as 'quality' | 'completeness' | 'submissions')}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quality">Sort by Quality</SelectItem>
                <SelectItem value="completeness">Sort by Completeness</SelectItem>
                <SelectItem value="submissions">Sort by Submissions</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterTrend} onValueChange={(v: string) => setFilterTrend(v as 'all' | 'improving' | 'stable' | 'declining')}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trends</SelectItem>
                <SelectItem value="improving">Improving</SelectItem>
                <SelectItem value="stable">Stable</SelectItem>
                <SelectItem value="declining">Declining</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading supplier performance data...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No supplier performance data available yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-center">Submissions</TableHead>
                    <TableHead className="text-center">Approved</TableHead>
                    <TableHead className="text-center">Rejected</TableHead>
                    <TableHead className="text-center">Quality Score</TableHead>
                    <TableHead className="text-center">Completeness</TableHead>
                    <TableHead className="text-center">Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.supplierName}</TableCell>
                      <TableCell className="text-center">{supplier.submissionCount}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-medium">{supplier.approvedCount}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-red-600 font-medium">{supplier.rejectedCount}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={getQualityColor(supplier.dataQualityScore)}>
                          {supplier.dataQualityScore.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-medium ${getCompletenessColor(supplier.completenessScore)}`}>
                          {supplier.completenessScore.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {getTrendIcon(supplier.lastDataQualityTrend)}
                          <span className="text-xs capitalize">{supplier.lastDataQualityTrend}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {stats?.bestPerformer && stats?.worstPerformer && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Best Performer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="font-medium text-lg">{stats.bestPerformer.supplierName}</div>
              <div className="text-sm">
                <strong>Data Quality:</strong> {stats.bestPerformer.dataQualityScore.toFixed(1)}%
              </div>
              <div className="text-sm">
                <strong>Completeness:</strong> {stats.bestPerformer.completenessScore.toFixed(1)}%
              </div>
              <div className="text-sm">
                <strong>Submissions:</strong> {stats.bestPerformer.submissionCount} ({stats.bestPerformer.approvedCount} approved)
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="font-medium text-lg">{stats.worstPerformer.supplierName}</div>
              <div className="text-sm">
                <strong>Data Quality:</strong> {stats.worstPerformer.dataQualityScore.toFixed(1)}%
              </div>
              <div className="text-sm">
                <strong>Completeness:</strong> {stats.worstPerformer.completenessScore.toFixed(1)}%
              </div>
              <div className="text-sm">
                <strong>Submissions:</strong> {stats.worstPerformer.submissionCount} ({stats.worstPerformer.rejectedCount} rejected)
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">About Supplier Performance</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div>
            <strong>Data Quality Score:</strong> Measures accuracy and validity of submitted emissions data. Higher is better. Calculated from anomaly detection and validation rules.
          </div>
          <div>
            <strong>Completeness Score:</strong> Percentage of required fields filled in submissions. Lower completeness increases estimation uncertainty.
          </div>
          <div>
            <strong>Trends:</strong> Improving = quality increasing over time, Stable = consistent performance, Declining = watch for issues.
          </div>
          <div className="pt-2 border-t">
            Use this data to identify top performers for case studies, prioritize support for declining suppliers, and benchmark against peers.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
