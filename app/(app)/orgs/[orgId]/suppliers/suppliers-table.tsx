'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';
import { HEALTH_LABELS, filterSuppliers, healthOf } from '@/lib/suppliers/filter';

interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  submissionCount: number;
  approvalRate: number;
  rejectionRate: number;
  onTimeRate: number;
  completenessScore: number;
  dataQualityScore: number;
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: string;
}

const trendIcon = {
  improving: <TrendingUp className="h-4 w-4 text-green-600" />,
  stable: <Minus className="h-4 w-4 text-gray-600" />,
  declining: <TrendingDown className="h-4 w-4 text-red-600" />,
};

const trendColor = {
  improving: 'text-green-600 font-medium',
  stable: 'text-gray-600',
  declining: 'text-red-600 font-medium',
};

export function SuppliersTable({ orgId, filters }: { orgId: string; filters: Record<string, string> }) {
  const [suppliers, setSuppliers] = useState<SupplierPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch(`/api/orgs/${orgId}/suppliers`);
        if (!res.ok) throw new Error('Failed to fetch suppliers');
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuppliers();
  }, [orgId]);

  const scoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 text-green-900';
    if (score >= 60) return 'bg-amber-50 text-amber-900';
    return 'bg-red-50 text-red-900';
  };

  const shown = filterSuppliers(suppliers, filters);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Supplier Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Error: {error}
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No suppliers with submission history
            </div>
          ) : shown.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No suppliers match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Submissions</TableHead>
                    <TableHead className="text-right">Approval Rate</TableHead>
                    <TableHead className="text-right">On-Time Rate</TableHead>
                    <TableHead className="text-right">Data Quality</TableHead>
                    <TableHead className="text-center">Trend</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((supplier) => (
                    <TableRow
                      key={supplier.supplierId}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={`/orgs/${orgId}/suppliers/${supplier.supplierId}/dashboard`}
                          className="text-blue-600 hover:underline"
                        >
                          {supplier.supplierName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        {supplier.submissionCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {Math.round(supplier.approvalRate)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {Math.round(supplier.onTimeRate)}%
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={scoreColor(supplier.dataQualityScore)}>
                          {Math.round(supplier.dataQualityScore)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div
                          className={`flex items-center justify-center gap-1 ${trendColor[supplier.trend]}`}
                        >
                          {trendIcon[supplier.trend]}
                          <span className="text-sm capitalize">
                            {supplier.trend}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {healthOf(supplier.dataQualityScore) === 'healthy' ? (
                          <Badge variant="default" className="bg-green-600">
                            {HEALTH_LABELS.healthy}
                          </Badge>
                        ) : healthOf(supplier.dataQualityScore) === 'at_risk' ? (
                          <Badge
                            variant="outline"
                            className="border-amber-600 text-amber-600"
                          >
                            {HEALTH_LABELS.at_risk}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">{HEALTH_LABELS.critical}</Badge>
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
    </div>
  );
}
