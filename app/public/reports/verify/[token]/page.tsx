'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Download, AlertCircle, CheckCircle } from 'lucide-react';

interface ReportVerification {
  report: {
    id: string;
    type: string;
    status: 'ready' | 'generating' | 'failed';
    version: number;
    generatedAt: string;
    sha256: string;
    orgName: string;
    snapshotId: string;
    snapshotVersion: number;
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    snapshotPublishedAt: string;
  };
  auditTrail: Array<{
    timestamp: string;
    actor: string;
    action: string;
  }>;
  integrity: {
    verified: boolean;
    brokenAt?: number;
    message: string;
  };
  downloads?: {
    pdf: string;
    csv: string;
  } | null;
}

export default function ReportVerificationPage({ params }: { params: Promise<{ token: string }> }) {
  const [data, setData] = useState<ReportVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [tokenValue, setTokenValue] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { token } = await params;
        setTokenValue(token);

        const response = await fetch(`/api/public/reports/verify/${token}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Report verification token not found or has expired.');
          } else if (response.status === 410) {
            setError('This report verification link has expired (90-day window).');
          } else {
            setError(`Error loading report: ${response.statusText}`);
          }
          return;
        }

        const result = await response.json() as ReportVerification;
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(`Failed to load report verification: ${err instanceof Error ? err.message : String(err)}`);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [params]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
              <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-zinc-600">Loading report verification...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h2 className="font-semibold text-red-900">Verification Error</h2>
            </div>
            <p className="text-zinc-700 mb-6">{error}</p>
            <p className="text-sm text-zinc-500">
              If you believe this is an error, please contact the organization that generated this report.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { report, auditTrail, integrity, downloads } = data;
  const statusColor = report.status === 'ready' ? 'text-green-700' : report.status === 'failed' ? 'text-red-700' : 'text-amber-700';
  const statusBg = report.status === 'ready' ? 'bg-green-50' : report.status === 'failed' ? 'bg-red-50' : 'bg-amber-50';

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-8 text-white">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold">Report Verification</h1>
              <CheckCircle className="w-8 h-8" />
            </div>
            <p className="text-blue-100">QR code verified • Report integrity confirmed</p>
          </div>

          {/* Content */}
          <div className="p-8 space-y-8">
            {/* Organization & Report Info */}
            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mb-4">Report Details</h2>
              <div className={`rounded-lg ${statusBg} p-4 mb-4`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${statusColor}`}>
                      {report.status === 'ready' ? 'Ready for Download' : report.status === 'generating' ? 'Generating' : 'Generation Failed'}
                    </p>
                    <p className="text-zinc-600 text-sm mt-1">Version {report.version}</p>
                  </div>
                  {integrity.verified && (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-zinc-600">Organization</p>
                  <p className="font-semibold text-zinc-900">{report.orgName}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-600">Report Type</p>
                  <p className="font-semibold text-zinc-900 capitalize">{report.type.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-600">Reporting Period</p>
                  <p className="font-semibold text-zinc-900">{report.periodLabel}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-600">Generated</p>
                  <p className="font-semibold text-zinc-900">{new Date(report.generatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </section>

            {/* Integrity Check */}
            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mb-4">Integrity Verification</h2>
              <div className={`rounded-lg border-2 ${integrity.verified ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} p-4`}>
                <div className="flex items-start gap-3">
                  {integrity.verified ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-semibold ${integrity.verified ? 'text-green-900' : 'text-red-900'}`}>
                      {integrity.message}
                    </p>
                    <p className="text-sm text-zinc-600 mt-1">
                      SHA-256: <code className="font-mono text-xs">{report.sha256.slice(0, 16)}...</code>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Download Section */}
            {downloads && (
              <section>
                <h2 className="text-lg font-semibold text-zinc-900 mb-4">Download Report</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href={downloads.pdf}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    download
                  >
                    <Download className="w-4 h-4" />
                    PDF Report
                  </a>
                  <a
                    href={downloads.csv}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                    download
                  >
                    <Download className="w-4 h-4" />
                    CSV Export
                  </a>
                </div>
              </section>
            )}

            {/* Audit Trail */}
            <section>
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors mb-3"
              >
                <div className="text-left">
                  <h2 className="font-semibold text-zinc-900">Audit Trail</h2>
                  <p className="text-sm text-zinc-600">{auditTrail.length} events</p>
                </div>
                <ChevronDown className={`w-5 h-5 text-zinc-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {expanded && (
                <div className="space-y-3">
                  {auditTrail.map((event, idx) => (
                    <div key={idx} className="border border-zinc-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-zinc-900">{event.action}</p>
                        <p className="text-xs text-zinc-500">{new Date(event.timestamp).toLocaleString()}</p>
                      </div>
                      <p className="text-sm text-zinc-600">By: {event.actor}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Footer */}
            <div className="pt-6 border-t border-zinc-200">
              <p className="text-xs text-zinc-500 text-center">
                This report was generated by CarbonSite and verified at {new Date().toLocaleString()}
              </p>
              <p className="text-xs text-zinc-500 text-center mt-2">
                Token: <code className="font-mono">{tokenValue.slice(0, 8)}...</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
