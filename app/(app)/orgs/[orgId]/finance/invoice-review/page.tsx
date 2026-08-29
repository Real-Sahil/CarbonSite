'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, CheckCircle, XCircle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface InvoiceAnomaly {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  vendorName: string;
  amount: number;
  anomalyType: string;
  severity: 'info' | 'warning' | 'critical';
  reason: string;
  resolution: string;
  detectedAt: string;
}

export default function InvoiceReviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  
  const [anomalies, setAnomalies] = useState<InvoiceAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnomalies = async () => {
      try {
        const query = filter === 'all' ? '' : `?severity=${filter}`;
        const res = await fetch(`/api/orgs/${orgId}/invoices/anomalies${query}`);
        const data = await res.json();
        setAnomalies(data.data || []);
      } catch (error) {
        console.error('Error fetching anomalies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnomalies();
  }, [orgId, filter]);

  const handleResolve = async (anomalyId: string, resolution: 'approved' | 'rejected', notes?: string) => {
    setResolvingId(anomalyId);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/invoices/anomalies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anomalyId, resolution, resolutionNotes: notes }),
        }
      );

      if (res.ok) {
        setAnomalies(anomalies.filter((a) => a.id !== anomalyId));
      }
    } catch (error) {
      console.error('Error resolving anomaly:', error);
    } finally {
      setResolvingId(null);
    }
  };

  const severityColor = {
    critical: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
  };

  const severityIcon = {
    critical: <XCircle className="w-5 h-5 text-red-600" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-600" />,
    info: <CheckCircle className="w-5 h-5 text-blue-600" />,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Invoice Anomaly Review</h1>
        <p className="mt-2 text-gray-600">
          Review and approve/reject flagged invoices before they flow into Scope 3 calculations.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          All ({anomalies.length})
        </Button>
        <Button
          variant={filter === 'critical' ? 'default' : 'outline'}
          onClick={() => setFilter('critical')}
          className="border-red-200"
        >
          Critical
        </Button>
        <Button
          variant={filter === 'warning' ? 'default' : 'outline'}
          onClick={() => setFilter('warning')}
          className="border-yellow-200"
        >
          Warning
        </Button>
        <Button
          variant={filter === 'info' ? 'default' : 'outline'}
          onClick={() => setFilter('info')}
          className="border-blue-200"
        >
          Info
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading anomalies...</div>
      ) : anomalies.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No anomalies found. All invoices look good!
        </div>
      ) : (
        <div className="space-y-4">
          {anomalies.map((anomaly) => (
            <div
              key={anomaly.id}
              className={`p-4 border rounded-lg ${severityColor[anomaly.severity]}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {severityIcon[anomaly.severity]}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {anomaly.invoiceNumber} - {anomaly.vendorName}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">{anomaly.reason}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Amount: GBP {anomaly.amount.toFixed(2)} | Type: {anomaly.anomalyType}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResolve(anomaly.id, 'approved')}
                    disabled={resolvingId === anomaly.id}
                    className="border-green-200 text-green-700"
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResolve(anomaly.id, 'rejected')}
                    disabled={resolvingId === anomaly.id}
                    className="border-red-200 text-red-700"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
