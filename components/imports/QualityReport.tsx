'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface FailureSample {
  rowNumber: number;
  field: string;
  value: unknown;
  expected: string;
}

interface QualityCheck {
  type: string;
  name: string;
  passed: boolean;
  failuresCount: number;
  failureSamples?: FailureSample[];
}

interface QualityScore {
  overallScore: number;
  checksPassed: number;
  checksTotal: number;
  canCommit: boolean;
}

interface QualityReportProps {
  orgId: string;
  importId: string;
  onDataReady?: (canCommit: boolean) => void;
}

export function QualityReport({ orgId, importId, onDataReady }: QualityReportProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [checks, setChecks] = useState<QualityCheck[]>([]);

  useEffect(() => {
    async function fetchQualityReport() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/orgs/${orgId}/imports/${importId}/quality-report`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch quality report');
        }

        const data = await response.json();
        setQualityScore(data.qualityScore);
        setChecks(data.checks);
        onDataReady?.(data.qualityScore.canCommit);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setQualityScore(null);
      } finally {
        setLoading(false);
      }
    }

    fetchQualityReport();
  }, [orgId, importId, onDataReady]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Analyzing data quality...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="py-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!qualityScore) return null;

  const scorePercentage = Math.round(qualityScore.overallScore);
  const scoreColor =
    scorePercentage >= 80
      ? 'text-green-600'
      : scorePercentage >= 60
        ? 'text-yellow-600'
        : 'text-red-600';

  const scoreBackground =
    scorePercentage >= 80
      ? 'bg-green-50'
      : scorePercentage >= 60
        ? 'bg-yellow-50'
        : 'bg-red-50';

  return (
    <div className="space-y-4">
      {/* Quality Score Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data Quality Assessment</CardTitle>
          <CardDescription>
            {qualityScore.canCommit
              ? 'Data quality is sufficient for commitment'
              : 'Data quality needs improvement before commitment'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`p-6 rounded-lg ${scoreBackground}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-5xl font-bold ${scoreColor}`}>
                  {scorePercentage}%
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {qualityScore.checksPassed} of {qualityScore.checksTotal} checks passed
                </p>
              </div>
              <div className="text-right">
                {qualityScore.canCommit ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      Ready to Commit
                    </Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-8 w-8 text-yellow-600" />
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      Review Required
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quality Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checks.map((check) => (
              <div
                key={check.type}
                className="flex items-start gap-3 p-3 rounded-lg border"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {check.passed ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{check.name}</p>
                  {!check.passed && check.failureSamples && check.failureSamples.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-600">
                        {check.failuresCount} row(s) affected. Sample failures:
                      </p>
                      <div className="bg-gray-50 p-2 rounded text-xs font-mono">
                        {check.failureSamples.slice(0, 3).map((sample, idx) => (
                          <div key={idx} className="text-gray-700">
                            Row {sample.rowNumber} ({sample.field}): &quot;{String(sample.value)}&quot; (expected: {sample.expected})
                          </div>
                        ))}
                        {check.failureSamples.length > 3 && (
                          <div className="text-gray-500 mt-1">
                            +{check.failureSamples.length - 3} more...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Commitment Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {qualityScore.canCommit
                ? 'This import meets quality standards and is ready to be committed to your emissions inventory.'
                : 'Please review the failing checks above. You can still commit this import, but data quality issues should be resolved before using the data in calculations.'}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-green-700">Quality score is {scorePercentage >= 80 ? 'good' : 'below optimal'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
