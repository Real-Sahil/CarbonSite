'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface InvoiceAnomaly {
  id: string;
  anomalyType: string;
  severity: 'info' | 'warning' | 'critical';
  reason: string;
  resolution: 'pending' | 'approved' | 'rejected' | null;
  detectedAt: string;
  resolvedAt?: string;
  notes?: string;
  invoice: {
    id: string;
    externalInvoiceId: string;
    vendorName: string;
    totalAmount: number;
    invoiceDate: string;
  };
  resolvedByUser?: {
    name: string;
    email: string;
  };
}

export default function InvoiceReviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [anomalies, setAnomalies] = useState<InvoiceAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [severityFilter, setSeverityFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [resolutionFilter, setResolutionFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchAnomalies = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (severityFilter !== 'all') params.append('severity', severityFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (resolutionFilter !== 'all') params.append('resolution', resolutionFilter);
      params.append('limit', '100');

      const res = await fetch(`/api/orgs/${orgId}/invoices/anomalies?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch anomalies');

      const data = await res.json();
      setAnomalies(data.anomalies || []);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId, severityFilter, typeFilter, resolutionFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAnomalies();
  }, [fetchAnomalies]);

  const handleBulkResolve = async (resolution: 'approved' | 'rejected') => {
    if (selectedIds.size === 0) return;

    try {
      setIsProcessing(true);
      const res = await fetch(`/api/orgs/${orgId}/invoices/anomalies`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomalyIds: Array.from(selectedIds),
          resolution,
        }),
      });

      if (!res.ok) throw new Error('Failed to resolve anomalies');

      await fetchAnomalies();
      alert(`Successfully ${resolution} ${selectedIds.size} anomalies`);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleAllSelection = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(anomalies.map(a => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelection = (id: string, checked: boolean) => {
    const newIds = new Set(selectedIds);
    if (checked) {
      newIds.add(id);
    } else {
      newIds.delete(id);
    }
    setSelectedIds(newIds);
  };

  const getAnomalyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      duplicate: 'Duplicate Invoice',
      qty_mismatch: 'Quantity Mismatch',
      price_spike: 'Price Spike',
      date_inconsistency: 'Date Issue',
      missing_grn: 'Missing Receipt',
      over_billing: 'Over-Billing',
      orphaned: 'Orphaned Line',
      duplicate_line: 'Duplicate Line Item',
    };
    return labels[type] || type;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const stats = {
    critical: anomalies.filter(a => a.severity === 'critical' && a.resolution === 'pending').length,
    warning: anomalies.filter(a => a.severity === 'warning' && a.resolution === 'pending').length,
    info: anomalies.filter(a => a.severity === 'info' && a.resolution === 'pending').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invoice Anomaly Review</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve invoices flagged by our anomaly detection system before they flow into Scope 3 calculations
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Critical Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{stats.critical}</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{stats.warning}</div>
            <p className="text-xs text-muted-foreground">Review recommended</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{stats.info}</div>
            <p className="text-xs text-muted-foreground">FYI items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Selected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedIds.size}</div>
            <p className="text-xs text-muted-foreground">For bulk actions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by severity, type, and resolution status</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="text-sm font-medium">Severity</label>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as "info" | "warning" | "critical" | "all")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="duplicate">Duplicate</SelectItem>
                <SelectItem value="qty_mismatch">Quantity Mismatch</SelectItem>
                <SelectItem value="price_spike">Price Spike</SelectItem>
                <SelectItem value="date_inconsistency">Date Issue</SelectItem>
                <SelectItem value="missing_grn">Missing Receipt</SelectItem>
                <SelectItem value="over_billing">Over-Billing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Status</label>
            <Select value={resolutionFilter} onValueChange={(v) => setResolutionFilter(v as "approved" | "rejected" | "pending" | "all")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={fetchAnomalies}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{selectedIds.size} anomalies selected</p>
                <p className="text-sm text-muted-foreground">Choose an action to apply to all selected items</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={() => handleBulkResolve('approved')}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isProcessing ? 'Processing...' : 'Approve All'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleBulkResolve('rejected')}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Reject All'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Anomalies</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${anomalies.length} anomalies found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-center py-8 text-red-600">{error}</div>
          )}
          {loading && (
            <div className="text-center py-8 text-muted-foreground">Loading anomalies...</div>
          )}
          {!loading && anomalies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No anomalies found. All invoices are approved!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === anomalies.length && anomalies.length > 0}
                        onCheckedChange={toggleAllSelection}
                      />
                    </TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Anomaly</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anomalies.map((anomaly) => (
                    <TableRow key={anomaly.id} className={anomaly.resolution === 'pending' ? 'hover:bg-muted/50' : 'opacity-60'}>
                      <TableCell>
                        {anomaly.resolution === 'pending' && (
                          <Checkbox
                            checked={selectedIds.has(anomaly.id)}
                            onCheckedChange={(checked) => toggleSelection(anomaly.id, checked as boolean)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {anomaly.invoice.externalInvoiceId}
                      </TableCell>
                      <TableCell className="text-sm">
                        {anomaly.invoice.vendorName}
                      </TableCell>
                      <TableCell className="text-sm">
                        £{parseFloat(anomaly.invoice.totalAmount.toString()).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <p className="font-medium">{getAnomalyTypeLabel(anomaly.anomalyType)}</p>
                          <p className="text-xs text-muted-foreground">{anomaly.reason}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(anomaly.severity)}
                          <Badge
                            variant={
                              anomaly.severity === 'critical'
                                ? 'destructive'
                                : anomaly.severity === 'warning'
                                  ? 'outline'
                                  : 'secondary'
                            }
                          >
                            {anomaly.severity}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {anomaly.resolution === 'approved' && (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-xs text-green-600">Approved</span>
                            </>
                          )}
                          {anomaly.resolution === 'rejected' && (
                            <>
                              <AlertCircle className="w-4 h-4 text-red-600" />
                              <span className="text-xs text-red-600">Rejected</span>
                            </>
                          )}
                          {!anomaly.resolution && (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(anomaly.detectedAt), 'MMM d, HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">About Invoice Anomaly Detection</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div>
            <strong>Critical Issues:</strong> Likely fraud, over-billing, or duplicate invoices. Must be resolved before approval.
          </div>
          <div>
            <strong>Warnings:</strong> Data quality issues like date inconsistencies or missing receipts. Approve if you&apos;ve verified the invoice manually.
          </div>
          <div>
            <strong>Info:</strong> Minor FYI items like price fluctuations. Generally safe to approve in bulk.
          </div>
          <div className="pt-2 border-t">
            Approved invoices flow into Scope 3 spend calculations. Rejected invoices are excluded from emissions totals until re-evaluated.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
