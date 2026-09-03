"use client";

import { useMemo } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QualityScoreProps {
  score: number;
  checksPassed: number;
  checksTotal: number;
  canCommit: boolean;
  failures?: Array<{
    rowNumber: number;
    field: string;
    value: unknown;
    expected: string;
  }>;
}

export function QualityScore({
  score,
  checksPassed,
  checksTotal,
  canCommit,
  failures,
}: QualityScoreProps) {
  const scoreColor = useMemo(() => {
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-yellow-600";
    if (score >= 70) return "text-orange-600";
    return "text-red-600";
  }, [score]);

  const scoreBgColor = useMemo(() => {
    if (score >= 90) return "bg-green-50";
    if (score >= 80) return "bg-yellow-50";
    if (score >= 70) return "bg-orange-50";
    return "bg-red-50";
  }, [score]);

  return (
    <Card className={scoreBgColor}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Data Quality Score</CardTitle>
            <CardDescription>Validation results for this import batch</CardDescription>
          </div>
          {canCommit ? (
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          ) : (
            <AlertCircle className="w-8 h-8 text-red-600" />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Score gauge */}
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <span className={`text-5xl font-bold ${scoreColor}`}>{score.toFixed(1)}%</span>
            <div className="text-sm text-gray-600">
              {checksPassed} of {checksTotal} checks passed
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                score >= 90
                  ? "bg-green-600"
                  : score >= 80
                    ? "bg-yellow-600"
                    : score >= 70
                      ? "bg-orange-600"
                      : "bg-red-600"
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* Status alert */}
        {canCommit ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Data quality acceptable. This import can be committed to your records.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Data quality below threshold. Please review and fix the issues below before committing.
            </AlertDescription>
          </Alert>
        )}

        {/* Failure samples */}
        {failures && failures.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Sample Issues Found:</h4>
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Row</th>
                    <th className="px-3 py-2 text-left font-medium">Field</th>
                    <th className="px-3 py-2 text-left font-medium">Value</th>
                    <th className="px-3 py-2 text-left font-medium">Expected</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.slice(0, 5).map((failure, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{failure.rowNumber}</td>
                      <td className="px-3 py-2 font-medium text-xs">{failure.field}</td>
                      <td className="px-3 py-2 font-mono text-xs text-red-600">
                        {typeof failure.value === "string" ? failure.value : JSON.stringify(failure.value)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{failure.expected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {failures.length > 5 && (
              <p className="text-xs text-gray-500 text-center">
                ... and {failures.length - 5} more issues
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
