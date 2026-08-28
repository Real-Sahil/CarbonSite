"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface InvoiceAnomaly {
  id: string;
  anomalyType: string;
  severity: "info" | "warning" | "critical";
  reason: string;
  resolution?: string;
  detectedAt: string;
  invoice: {
    externalInvoiceId: string;
    vendorName: string;
    totalAmount: number;
    invoiceDate: string;
  };
}

const severityColors: Record<
  "info" | "warning" | "critical",
  "default" | "secondary" | "destructive"
> = {
  info: "default",
  warning: "secondary",
  critical: "destructive",
};

const anomalyTypeIcons: Record<string, string> = {
  duplicate: "🔄",
  qty_mismatch: "📦",
  date_inconsistency: "📅",
  price_spike: "📈",
  missing_grn: "❌",
  over_billing: "💰",
  currency_mismatch: "💱",
  unmatched_invoice: "🔗",
};

export default function InvoiceReviewPage() {
  const { orgId } = useParams() as { orgId: string };
  const [anomalies, setAnomalies] = useState<InvoiceAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnomalies, setSelectedAnomalies] = useState<Set<string>>(
    new Set()
  );
  const [severityFilter, setSeverityFilter] = useState<
    "all" | "info" | "warning" | "critical"
  >("all");
  const [resolutionFilter, setResolutionFilter] = useState<
    "all" | "pending" | "resolved"
  >("pending");
  const [searchVendor, setSearchVendor] = useState("");
  const [bulkResolution, setBulkResolution] = useState<string>("");

  const fetchAnomalies = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (severityFilter !== "all") {
        params.append("severity", severityFilter);
      }
      if (resolutionFilter === "pending") {
        params.append("status", "unresolved");
      } else if (resolutionFilter === "resolved") {
        params.append("status", "resolved");
      }

      const response = await fetch(
        `/api/orgs/${orgId}/invoices/anomalies?${params.toString()}`
      );
      const data = await response.json();
      setAnomalies(data.anomalies || []);
    } catch (error) {
      console.error("Failed to fetch anomalies:", error);
    } finally {
      setLoading(false);
    }
  }, [severityFilter, resolutionFilter, orgId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAnomalies();
  }, [fetchAnomalies]);

  const filteredAnomalies = anomalies.filter((anomaly) => {
    const vendorMatch = anomaly.invoice.vendorName
      .toLowerCase()
      .includes(searchVendor.toLowerCase());
    return vendorMatch;
  });

  const handleSelectAnomaly = (id: string) => {
    const newSelected = new Set(selectedAnomalies);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAnomalies(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedAnomalies.size === filteredAnomalies.length) {
      setSelectedAnomalies(new Set());
    } else {
      setSelectedAnomalies(
        new Set(filteredAnomalies.map((a) => a.id))
      );
    }
  };

  const handleBulkResolve = async () => {
    if (selectedAnomalies.size === 0 || !bulkResolution) {
      return;
    }

    try {
      const response = await fetch(
        `/api/orgs/${orgId}/invoices/anomalies`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anomalyIds: Array.from(selectedAnomalies),
            resolution: bulkResolution,
          }),
        }
      );

      if (response.ok) {
        setSelectedAnomalies(new Set());
        setBulkResolution("");
        fetchAnomalies();
      }
    } catch (error) {
      console.error("Failed to resolve anomalies:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Invoice Anomaly Review</h1>
        <div className="text-sm text-muted-foreground">
          {filteredAnomalies.length} anomalies found
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Input
          placeholder="Search vendor name..."
          value={searchVendor}
          onChange={(e) => setSearchVendor(e.target.value)}
        />
        <Select
          value={severityFilter}
          onValueChange={(val) => setSeverityFilter(val as "all" | "info" | "warning" | "critical")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={resolutionFilter}
          onValueChange={(val) => setResolutionFilter(val as "all" | "pending" | "resolved")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedAnomalies.size > 0 && (
        <div className="flex gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex-1">
            <p className="font-medium">
              {selectedAnomalies.size} anomalies selected
            </p>
          </div>
          <Select value={bulkResolution} onValueChange={setBulkResolution}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Resolution action..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approved">Approve</SelectItem>
              <SelectItem value="rejected">Reject</SelectItem>
              <SelectItem value="pending_investigation">
                Pending Investigation
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleBulkResolve}
            disabled={!bulkResolution}
          >
            Apply
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedAnomalies(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={
                    filteredAnomalies.length > 0 &&
                    selectedAnomalies.size === filteredAnomalies.length
                  }
                  onChange={handleSelectAll}
                  className="rounded"
                />
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredAnomalies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  No anomalies found
                </TableCell>
              </TableRow>
            ) : (
              filteredAnomalies.map((anomaly) => (
                <TableRow
                  key={anomaly.id}
                  className={
                    selectedAnomalies.has(anomaly.id)
                      ? "bg-yellow-50"
                      : undefined
                  }
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedAnomalies.has(anomaly.id)}
                      onChange={() => handleSelectAnomaly(anomaly.id)}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell className="text-xl">
                    {anomalyTypeIcons[anomaly.anomalyType] || "⚠️"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {anomaly.invoice.vendorName}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {anomaly.invoice.externalInvoiceId}
                  </TableCell>
                  <TableCell className="text-right">
                    GBP {anomaly.invoice.totalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">
                    {anomaly.reason}
                  </TableCell>
                  <TableCell>
                    <Badge variant={severityColors[anomaly.severity]}>
                      {anomaly.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(anomaly.detectedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={anomaly.resolution ? "outline" : "secondary"}
                    >
                      {anomaly.resolution || "Pending"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
