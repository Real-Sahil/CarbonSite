'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, Filter, Zap, CheckCircle, FileText } from 'lucide-react';

interface LineageStep {
  step: number;
  stage: string;
  description: string;
  timestamp: string;
  recordCount?: number;
  status: 'completed' | 'in_progress' | 'pending';
  details?: string[];
}

interface LineageData {
  snapshotId: string;
  reportingPeriod: string;
  createdAt: string;
  steps: LineageStep[];
  totalRecords: number;
  qualityScore: number;
}

export default function DataLineagePage() {
  const [data, setData] = useState<LineageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLineage() {
      try {
        setLoading(true);
        // In a real implementation, this would fetch from an API
        // For now, we'll show a mock implementation
        const mockData: LineageData = {
          snapshotId: 'snap_abc123',
          reportingPeriod: '2024-Q3',
          createdAt: new Date().toISOString(),
          totalRecords: 1523,
          qualityScore: 87.5,
          steps: [
            {
              step: 1,
              stage: 'Data Import',
              description: 'Activity records imported from CSV uploads and field submissions',
              timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              recordCount: 1523,
              status: 'completed',
              details: [
                'CSV uploads: 1200 records',
                'Field submissions: 323 records',
                'Validation passed: 100%',
              ],
            },
            {
              step: 2,
              stage: 'Data Quality Checks',
              description: 'Records validated for completeness and accuracy',
              timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
              recordCount: 1523,
              status: 'completed',
              details: [
                'Null checks: PASSED',
                'Unit validation: PASSED',
                'Date range validation: PASSED',
                'Anomaly detection: 23 flagged',
              ],
            },
            {
              step: 3,
              stage: 'Factor Selection',
              description: 'Emission factors matched to each activity record',
              timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
              status: 'completed',
              details: [
                'DEFRA 2025.1: 1200 records',
                'EPA GHG Hub 2025: 323 records',
                'Factor match rate: 100%',
              ],
            },
            {
              step: 4,
              stage: 'Calculation',
              description: 'CO2e calculated using GHG Protocol methodology',
              timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
              status: 'completed',
              details: [
                'Scope 1: 450 tonnes CO2e',
                'Scope 2: 320 tonnes CO2e',
                'Scope 3: 1250 tonnes CO2e',
                'GWP AR6 applied: CH4 = 27.9, N2O = 273',
              ],
            },
            {
              step: 5,
              stage: 'Snapshot Publication',
              description: 'Results locked and published for audit trail',
              timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'completed',
              details: [
                'SHA-256 hash: 7f3a8c...',
                'Immutable: Yes',
                'Audit trail: Complete',
              ],
            },
            {
              step: 6,
              stage: 'Report Generation',
              description: 'Compliance report generated from snapshot',
              timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'completed',
              details: [
                'Format: PDF + CSV',
                'Frameworks: CSRD, GHG Protocol',
                'Verification: Passed',
              ],
            },
          ],
        };
        setData(mockData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchLineage();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">Error: {error || 'Failed to load lineage data'}</p>
        </div>
      </div>
    );
  }

  const getStageIcon = (step: number) => {
    switch (step) {
      case 1:
        return <Database className="h-5 w-5" />;
      case 2:
        return <Filter className="h-5 w-5" />;
      case 3:
        return <Zap className="h-5 w-5" />;
      case 4:
        return <CheckCircle className="h-5 w-5" />;
      case 5:
        return <FileText className="h-5 w-5" />;
      case 6:
        return <FileText className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Data Lineage</h1>
        <p className="mt-2 text-gray-600">Track emissions data from source to report</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{data.totalRecords}</div>
            <p className="mt-2 text-sm text-gray-600">Activity records processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Quality Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.qualityScore}%</div>
            <p className="mt-2 text-sm text-gray-600">Data quality validation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Processing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="bg-green-100 text-green-800">Complete</Badge>
            <p className="mt-2 text-sm text-gray-600">All stages completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Lineage Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {data.steps.map((step, index) => (
              <div key={step.step}>
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="rounded-full bg-blue-100 p-3 text-blue-600">
                      {getStageIcon(step.step)}
                    </div>
                    {index < data.steps.length - 1 && (
                      <div className="my-2 h-12 w-1 bg-gray-200" />
                    )}
                  </div>

                  <div className="flex-1 pt-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {step.stage}
                      </h3>
                      <Badge className={getStatusColor(step.status)}>
                        {step.status}
                      </Badge>
                    </div>

                    <p className="mt-1 text-sm text-gray-600">{step.description}</p>

                    {step.recordCount && (
                      <p className="mt-2 text-sm text-gray-500">
                        Records: {step.recordCount.toLocaleString()}
                      </p>
                    )}

                    {step.details && step.details.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {step.details.map((detail, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-gray-600 before:mr-2 before:content-['•']"
                          >
                            {detail}
                          </li>
                        ))}
                      </ul>
                    )}

                    <p className="mt-3 text-xs text-gray-500">
                      {new Date(step.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit Trail Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="text-sm text-blue-900">
              This snapshot has a complete audit trail recording all transformations from raw data through
              calculation to final report. The hash chain ensures immutability and enables verification of any
              step in the process.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {data.steps.filter((s) => s.status === 'completed').length}
              </div>
              <p className="text-xs text-gray-600">Completed Steps</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">7f3a8c...</div>
              <p className="text-xs text-gray-600">SHA-256 Hash</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">Yes</div>
              <p className="text-xs text-gray-600">Immutable</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">100%</div>
              <p className="text-xs text-gray-600">Verified</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
