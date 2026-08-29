'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataQualityScorecard } from '@/components/dashboard/DataQualityScorecard';
import { AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import type { QualityScore, DataQualityMetrics } from '@/lib/data-quality/quality-scorer';

interface QualityReport {
  batchName: string;
  importDate: string;
  totalRows: number;
  successfulRows: number;
  qualityScore: QualityScore;
  metrics: DataQualityMetrics;
  checks: Array<{
    id: string;
    type: string;
    name: string;
    passed: boolean;
    failuresCount: number;
    failureSamples?: unknown;
    metadata?: unknown;
    createdAt: string;
  }>;
}

export default function QualityReportPage({
  params,
}: {
  params: Promise<{ orgId: string; importId: string }>;
}) {
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const { orgId, importId } = await params;
        const response = await fetch(`/api/orgs/${orgId}/imports/${importId}/quality-report`);

        if (!response.ok) {
          throw new Error(`Failed to load quality report (${response.status})`);
        }

        const data = await response.json();
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [params]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-900">Failed to load quality report</p>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!report) return null;

  const successRate = report.totalRows > 0
    ? ((report.successfulRows / report.totalRows) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Data Quality Report</h1>
        <p className="text-gray-600 mt-1">{report.batchName}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600">Total Records</div>
            <div className="text-3xl font-bold mt-1">{report.totalRows.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600">Successful</div>
            <div className="text-3xl font-bold mt-1 text-green-600">{report.successfulRows.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600">Success Rate</div>
            <div className="text-3xl font-bold mt-1 text-blue-600">{successRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600">Quality Score</div>
            <div className={`text-3xl font-bold mt-1 ${
              report.qualityScore.status === 'excellent' ? 'text-green-600' :
              report.qualityScore.status === 'good' ? 'text-blue-600' :
              report.qualityScore.status === 'fair' ? 'text-yellow-600' :
              'text-red-600'
            }`}>{report.qualityScore.overallScore}%</div>
          </CardContent>
        </Card>
      </div>

      <DataQualityScorecard score={report.qualityScore} batchName={report.batchName} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Validation Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Pass Rate by Check</h4>
              <div className="space-y-2">
                {report.checks.reduce((acc, check) => {
                  const existing = acc.find(c => c.type === check.type);
                  if (existing) {
                    if (check.passed) existing.passed++;
                    existing.total++;
                  } else {
                    acc.push({
                      type: check.type,
                      passed: check.passed ? 1 : 0,
                      total: 1,
                    });
                  }
                  return acc;
                }, [] as Array<{ type: string; passed: number; total: number }>).map((group) => (
                  <div key={group.type} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-gray-700">{group.type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${(group.passed / group.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-gray-600 text-xs">
                        {group.passed}/{group.total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Common Issues</h4>
              {report.metrics.commonIssues.length > 0 ? (
                <ul className="space-y-2">
                  {report.metrics.commonIssues.map((issue) => (
                    <li key={issue.issue} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-900 font-medium">{issue.issue}</p>
                        <p className="text-gray-600 text-xs">
                          {issue.count} occurrences ({issue.percentage.toFixed(1)}%)
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  No common issues detected
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Check Results</CardTitle>
          <CardDescription>Individual validation checks performed on this import</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-4 font-medium text-gray-900">Check Name</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-900">Type</th>
                  <th className="text-center py-2 px-4 font-medium text-gray-900">Status</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-900">Failures</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {report.checks.map((check) => (
                  <tr key={check.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 text-gray-900">{check.name}</td>
                    <td className="py-2 px-4 text-gray-600 capitalize">{check.type}</td>
                    <td className="py-2 px-4 text-center">
                      {check.passed ? (
                        <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Passed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full text-xs font-medium">
                          <AlertCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-600">
                      {check.failuresCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
