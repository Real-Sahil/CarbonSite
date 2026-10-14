'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

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
      <div className="min-h-screen bg-gradient-to-br from-[#F9FAFC] to-[#F9FAFC] flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F9FAFC] mb-4">
              <div className="w-6 h-6 border-2 border-[#c2400c] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-[#41505F]">Loading report verification...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F9FAFC] to-[#F9FAFC] flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h2 className="font-semibold text-red-900">Verification Error</h2>
            </div>
            <p className="text-[#41505F] mb-6">{error}</p>
            <p className="text-sm text-[#5B6A78]">
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
    <div className="min-h-screen bg-gradient-to-br from-[#F9FAFC] to-[#F9FAFC] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#c2400c] to-[#a33409] px-8 py-8 text-white">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl">Report Verification</h1>
              <CheckCircle className="w-8 h-8" />
            </div>
            <p className="text-[#FFF2EC]">QR code verified • Report integrity confirmed</p>
          </div>

          {/* Content */}
          <div className="p-8 space-y-8">
            {/* Organization & Report Info */}
            <section>
              <h2 className="text-lg font-semibold text-[#131d29] mb-4">Report Details</h2>
              <div className={`rounded-lg ${statusBg} p-4 mb-4`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${statusColor}`}>
                      {report.status === 'ready' ? 'Ready for Download' : report.status === 'generating' ? 'Generating' : 'Generation Failed'}
                    </p>
                    <p className="text-[#41505F] text-sm mt-1">Version {report.version}</p>
                  </div>
                  {integrity.verified && (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[#41505F]">Organization</p>
                  <p className="font-semibold text-[#131d29]">{report.orgName}</p>
                </div>
                <div>
                  <p className="text-sm text-[#41505F]">Report Type</p>
                  <p className="font-semibold text-[#131d29] capitalize">{report.type.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-[#41505F]">Reporting Period</p>
                  <p className="font-semibold text-[#131d29]">{report.periodLabel}</p>
                </div>
                <div>
                  <p className="text-sm text-[#41505F]">Generated</p>
                  <p className="font-semibold text-[#131d29]">{new Date(report.generatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </section>

            {/* Integrity Check */}
            <section>
              <h2 className="text-lg font-semibold text-[#131d29] mb-4">Integrity Verification</h2>
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
                    <p className="text-sm text-[#41505F] mt-1">
                      SHA-256: <code className="font-mono text-xs">{report.sha256.slice(0, 16)}...</code>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Download Section */}
            {downloads && (
              <section>
                <h2 className="text-lg font-semibold text-[#131d29] mb-4">Download Report</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href={downloads.pdf}
                    className={buttonVariants()}
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
                className="w-full flex items-center justify-between p-4 rounded-lg bg-[#F9FAFC] hover:bg-[#F9FAFC] transition-colors mb-3"
              >
                <div className="text-left">
                  <h2 className="font-semibold text-[#131d29]">Audit Trail</h2>
                  <p className="text-sm text-[#41505F]">{auditTrail.length} events</p>
                </div>
                <ChevronDown className={`w-5 h-5 text-[#41505F] transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {expanded && (
                <div className="space-y-3">
                  {auditTrail.map((event) => (
                    <div key={`${event.timestamp}:${event.action}:${event.actor}`} className="border border-[#E3E8EE] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-[#131d29]">{event.action}</p>
                        <p className="text-xs text-[#5B6A78]">{new Date(event.timestamp).toLocaleString()}</p>
                      </div>
                      <p className="text-sm text-[#41505F]">By: {event.actor}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Footer */}
            <div className="pt-6 border-t border-[#E3E8EE]">
              <p className="text-xs text-[#5B6A78] text-center">
                This report was generated by MetricOra and verified at {new Date().toLocaleString()}
              </p>
              <p className="text-xs text-[#5B6A78] text-center mt-2">
                Token: <code className="font-mono">{tokenValue.slice(0, 8)}...</code>
              </p>
              <p className="text-xs text-[#5B6A78] text-center mt-2">
                <a href="https://www.metricora.co.uk/?ref=verify" className="underline underline-offset-2 hover:text-[#131d29]">
                  What is MetricOra?
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
