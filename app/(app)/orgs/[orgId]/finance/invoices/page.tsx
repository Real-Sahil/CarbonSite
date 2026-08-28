'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

interface InvoiceAnomaly {
  id: string;
  invoiceId: string;
  invoice: {
    externalInvoiceId: string;
    vendorName: string;
    totalAmount: number;
    invoiceDate: string;
  };
  anomalyType: string;
  severity: 'info' | 'warning' | 'critical';
  reason: string;
  detectedAt: string;
  resolution: string | null;
  resolvedBy?: { name: string; email: string } | null;
  resolvedAt?: string | null;
}

interface PaginationMeta {
  nextCursor?: string;
  hasMore: boolean;
  limit: number;
}

export default function InvoicePage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolutionFilter, setResolutionFilter] = useState<string>('pending');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [cursor, setCursor] = useState<string | undefined>();

  const {
    data: anomaliesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      'invoice-anomalies',
      orgId,
      resolutionFilter,
      severityFilter,
      typeFilter,
      cursor,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (resolutionFilter) params.append('resolution', resolutionFilter);
      if (severityFilter) params.append('severity', severityFilter);
      if (typeFilter) params.append('type', typeFilter);
      if (cursor) params.append('cursor', cursor);
      params.append('limit', '20');

      const res = await fetch(
        `/api/orgs/${orgId}/invoices/anomalies?${params.toString()}`
      );
      if (!res.ok) throw new Error('Failed to fetch anomalies');
      return res.json();
    },
  });

  const anomalies = anomaliesData?.anomalies || [];
  const pagination: PaginationMeta = anomaliesData?.pagination || {
    hasMore: false,
    limit: 20,
  };

  const resolveMutation = useMutation({
    mutationFn: async (resolution: 'approved' | 'rejected') => {
      const anomalyIds = Array.from(selectedIds);
      const res = await fetch(
        `/api/orgs/${orgId}/invoices/anomalies`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            anomalyIds,
            resolution,
            notes: '',
          }),
        }
      );
      if (!res.ok) throw new Error('Failed to resolve anomalies');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['invoice-anomalies', orgId],
      });
      setSelectedIds(new Set());
    },
  });

  const severityIcon = {
    info: <Info className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    critical: <AlertCircle className="h-4 w-4" />,
  };

  const severityColor = {
    info: 'bg-blue-50 text-blue-900',
    warning: 'bg-amber-50 text-amber-900',
    critical: 'bg-red-50 text-red-900',
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === anomalies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(anomalies.map((a) => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const pendingCount = anomalies.filter(
    (a) => a.resolution === null
  ).length;
  const criticalCount = anomalies.filter(
    (a) => a.severity === 'critical' && a.resolution === null
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invoice Review</h1>
        <p className="text-gray-600 mt-2">
          Review and approve invoices before they enter Scope 3 calculations
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingCount}</div>
            <p className="text-xs text-gray-500 mt-1">
              Awaiting approval or rejection
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Critical Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{criticalCount}</div>
            <p className="text-xs text-gray-500 mt-1">
              Duplicates, over-billing detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Selected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{selectedIds.size}</div>
            <p className="text-xs text-gray-500 mt-1">
              Ready for bulk action
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Status
              </label>
              <Select value={resolutionFilter} onValueChange={setResolutionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Severity
              </label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Anomaly Type
              </label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="duplicate">Duplicate</SelectItem>
                  <SelectItem value="qty_mismatch">Quantity Mismatch</SelectItem>
                  <SelectItem value="price_spike">Price Spike</SelectItem>
                  <SelectItem value="date_inconsistency">Date Inconsistency</SelectItem>
                  <SelectItem value="over_billing">Over-billing</SelectItem>
                  <SelectItem value="missing_grn">Missing GRN</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {selectedIds.size} anomal{selectedIds.size === 1 ? 'y' : 'ies'} selected
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() =>
                    resolveMutation.mutate('approved')
                  }
                  disabled={resolveMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    resolveMutation.mutate('rejected')
                  }
                  disabled={resolveMutation.isPending}
                >
                  Reject
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Anomalies Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {resolutionFilter === 'pending'
              ? 'Pending Anomalies'
              : resolutionFilter === 'approved'
                ? 'Approved Anomalies'
                : 'Rejected Anomalies'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Error loading anomalies
            </div>
          ) : anomalies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No anomalies found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedIds.size > 0 &&
                          selectedIds.size === anomalies.length
                        }
                        indeterminate={
                          selectedIds.size > 0 &&
                          selectedIds.size < anomalies.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Anomaly</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anomalies.map((anomaly) => (
                    <TableRow key={anomaly.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(anomaly.id)}
                          onCheckedChange={() => toggleSelect(anomaly.id)}
                          disabled={anomaly.resolution !== null}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {anomaly.invoice.externalInvoiceId}
                      </TableCell>
                      <TableCell>{anomaly.invoice.vendorName}</TableCell>
                      <TableCell>£{anomaly.invoice.totalAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {anomaly.anomalyType
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={severityColor[anomaly.severity]}>
                          <span className="mr-1 inline-flex">
                            {severityIcon[anomaly.severity]}
                          </span>
                          {anomaly.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {anomaly.reason}
                      </TableCell>
                      <TableCell>
                        {anomaly.resolution ? (
                          <div className="text-xs">
                            <Badge
                              variant={
                                anomaly.resolution === 'approved'
                                  ? 'default'
                                  : 'destructive'
                              }
                            >
                              {anomaly.resolution}
                            </Badge>
                            {anomaly.resolvedBy && (
                              <p className="text-gray-500 mt-1">
                                by {anomaly.resolvedBy.name}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
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

      {/* Pagination */}
      {pagination.hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setCursor(pagination.nextCursor)}
            disabled={!pagination.nextCursor}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
