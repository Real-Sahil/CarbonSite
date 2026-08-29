'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import type { QualityScore } from '@/lib/data-quality/quality-scorer';

interface DataQualityScorecardProps {
  score: QualityScore;
  batchName?: string;
}

export function DataQualityScorecard({
  score,
  batchName = 'Import Batch',
}: DataQualityScorecardProps) {
  const statusColors = {
    excellent: { bg: 'bg-green-50', text: 'text-green-900', border: 'border-green-200' },
    good: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200' },
    fair: { bg: 'bg-yellow-50', text: 'text-yellow-900', border: 'border-yellow-200' },
    poor: { bg: 'bg-red-50', text: 'text-red-900', border: 'border-red-200' },
  };

  const colors = statusColors[score.status];

  return (
    <div className="space-y-6">
      <Card className={`${colors.border} border-2 ${colors.bg}`}>
        <CardHeader>
          <CardTitle className={colors.text}>Data Quality Assessment</CardTitle>
          <CardDescription>{batchName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Score */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overall Quality Score</p>
              <p className={`text-4xl font-bold ${colors.text}`}>{score.overallScore}%</p>
              <p className="text-sm text-gray-600 mt-1 capitalize">{score.status}</p>
            </div>
            <div className="w-24 h-24">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={score.status === 'excellent' ? '#10b981' : score.status === 'good' ? '#3b82f6' : score.status === 'fair' ? '#f59e0b' : '#ef4444'}
                  strokeWidth="6"
                  strokeDasharray={`${(score.overallScore / 100) * 283} 283`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
            </div>
          </div>

          {/* Dimension Breakdown */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {Object.entries(score.dimensions).map(([key, value]) => (
              <div key={key} className="bg-white p-3 rounded border border-gray-200">
                <p className="text-xs font-medium text-gray-600 capitalize mb-1">{key}</p>
                <p className="text-lg font-semibold">{value}%</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {score.warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                Warnings
              </h4>
              <div className="space-y-2">
                {score.warnings.map((warning, idx) => (
                  <Alert key={idx} className="bg-yellow-50 border-yellow-200">
                    <AlertDescription className="text-yellow-800 text-sm">{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {score.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-600" />
                Recommendations
              </h4>
              <ul className="space-y-1 text-sm text-gray-700">
                {score.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
