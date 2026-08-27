"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, TrendingUp, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DataQualityMetrics {
  overallScore: number;
  scoreBreakdown: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    consistency: number;
  };
  summary: {
    totalRecords: number;
    missingEvidence: number;
    outOfPeriod: number;
    uncategorized: number;
    pendingReview: number;
  };
  issues: Array<{
    code: string;
    severity: "critical" | "warning" | "info";
    message: string;
    affectedRecordCount: number;
    recommendation: string;
  }>;
  scoreInterpretation: string;
  trend?: Array<{
    month: string;
    score: number;
    recordCount: number;
  }>;
  riskRecords?: Array<{
    id: string;
    description: string;
    riskScore: number;
    risks: string[];
  }>;
}

const SEVERITY_CONFIG = {
  critical: { label: "Critical", icon: AlertCircle, cls: "text-red-600 bg-red-50" },
  warning: { label: "Warning", icon: AlertTriangle, cls: "text-amber-600 bg-amber-50" },
  info: { label: "Info", icon: TrendingUp, cls: "text-blue-600 bg-blue-50" },
};

const SCORE_INTERPRETATION = {
  excellent: { label: "Excellent", color: "bg-green-100", textColor: "text-green-900" },
  good: { label: "Good", color: "bg-blue-100", textColor: "text-blue-900" },
  fair: { label: "Fair", color: "bg-amber-100", textColor: "text-amber-900" },
  poor: { label: "Poor", color: "bg-red-100", textColor: "text-red-900" },
};

function getInterpretationLevel(score: number) {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "poor";
}

function ScoreGauge({ score }: { score: number }) {
  const percentage = Math.min(100, Math.max(0, score));
  const rotation = (percentage / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40 mb-6">
        <svg viewBox="0 0 200 120" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 20,100 A 80,80 0 0,1 180,100"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          {/* Score arc */}
          <path
            d={`M 20,100 A 80,80 0 0,1 ${20 + 160 * (percentage / 100)},${
              100 - 80 * Math.sin(Math.acos(1 - (percentage / 100)))
            }`}
            fill="none"
            stroke={
              percentage >= 80
                ? "#10b981"
                : percentage >= 60
                  ? "#3b82f6"
                  : percentage >= 40
                    ? "#f59e0b"
                    : "#ef4444"
            }
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Needle */}
          <g transform={`translate(100, 100) rotate(${rotation})`}>
            <line x1="0" y1="0" x2="0" y2="-70" stroke="#374151" strokeWidth="3" strokeLinecap="round" />
            <circle cx="0" cy="0" r="6" fill="#374151" />
          </g>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{Math.round(percentage)}</p>
            <p className="text-xs text-gray-500">out of 100</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DataQualityPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const [metrics, setMetrics] = useState<DataQualityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await fetch(
          `/api/orgs/${orgId}/data-quality?includeTrend=true&includeRiskRecords=true`
        );
        if (!res.ok) throw new Error("Failed to load data quality metrics");
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, [orgId]);

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-96 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-900">Error loading data quality metrics</p>
              <p className="text-sm text-red-700">{error || "Unknown error occurred"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const interpretation = getInterpretationLevel(metrics.overallScore);
  const interpretationConfig =
    SCORE_INTERPRETATION[interpretation as keyof typeof SCORE_INTERPRETATION];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Data Quality</h1>
        <p className="text-gray-600">
          Monitor emissions data completeness, accuracy, timeliness, and consistency across your organization.
        </p>
      </div>

      {/* Overall Score Card */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Data Quality Score</CardTitle>
          <CardDescription>{metrics.scoreInterpretation}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <ScoreGauge score={metrics.overallScore} />
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-600">Interpretation</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      interpretationConfig.color
                    } ${interpretationConfig.textColor}`}
                  >
                    {interpretationConfig.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {metrics.overallScore >= 80
                    ? "Your emissions data is audit-ready with high quality across all dimensions."
                    : metrics.overallScore >= 60
                      ? "Your data quality is good but has room for improvement. Address the warnings below to strengthen your position."
                      : metrics.overallScore >= 40
                        ? "Your data quality needs attention. Review critical issues and implement recommendations."
                        : "Your data requires immediate attention. Critical issues must be addressed before reporting."}
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Records Summary</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 p-2 rounded">
                      <p className="text-2xl font-bold text-blue-900">
                        {metrics.summary.totalRecords}
                      </p>
                      <p className="text-xs text-blue-600">Total records</p>
                    </div>
                    <div className="bg-amber-50 p-2 rounded">
                      <p className="text-2xl font-bold text-amber-900">
                        {metrics.summary.pendingReview}
                      </p>
                      <p className="text-xs text-amber-600">Pending review</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Completeness</CardTitle>
            <CardDescription>Required fields populated</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">{metrics.scoreBreakdown.completeness}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${metrics.scoreBreakdown.completeness}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {metrics.scoreBreakdown.completeness >= 90
                  ? "Excellent field coverage"
                  : metrics.scoreBreakdown.completeness >= 70
                    ? "Good field coverage with minor gaps"
                    : "Significant field gaps to address"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Accuracy</CardTitle>
            <CardDescription>Supporting evidence attached</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">{metrics.scoreBreakdown.accuracy}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${metrics.scoreBreakdown.accuracy}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">
                <span className="font-semibold">{metrics.summary.missingEvidence}</span> records
                without evidence
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Timeliness</CardTitle>
            <CardDescription>Within reporting period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">{metrics.scoreBreakdown.timeliness}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-amber-600 h-2 rounded-full"
                  style={{ width: `${metrics.scoreBreakdown.timeliness}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">
                <span className="font-semibold">{metrics.summary.outOfPeriod}</span> records
                out-of-period
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Consistency</CardTitle>
            <CardDescription>Standardized categorization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">{metrics.scoreBreakdown.consistency}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: `${metrics.scoreBreakdown.consistency}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">
                <span className="font-semibold">{metrics.summary.uncategorized}</span> records
                uncategorized
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues and Trends */}
      <Tabs defaultValue="issues" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="issues">
            Issues{" "}
            {metrics.issues.some((i) => i.severity === "critical") && (
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                !
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="trend">Trend</TabsTrigger>
          <TabsTrigger value="risks">High-Risk Records</TabsTrigger>
        </TabsList>

        <TabsContent value="issues">
          <Card>
            <CardHeader>
              <CardTitle>Data Quality Issues</CardTitle>
              <CardDescription>
                {metrics.issues.length === 0
                  ? "No issues detected"
                  : `${metrics.issues.length} issue${metrics.issues.length !== 1 ? "s" : ""} found`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.issues.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                  <p className="text-gray-600">All data quality checks passed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.issues.map((issue, idx) => {
                    const config = SEVERITY_CONFIG[issue.severity];
                    const IconComponent = config.icon;
                    return (
                      <div key={idx} className={`rounded-lg p-4 ${config.cls} border border-current/20`}>
                        <div className="flex gap-3">
                          <IconComponent className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">
                                  <span className="font-semibold">{issue.message}</span>
                                </p>
                                <p className="text-sm opacity-90 mt-1">{issue.recommendation}</p>
                              </div>
                              <span className="text-xs font-medium px-2 py-1 bg-white/50 rounded whitespace-nowrap">
                                {issue.affectedRecordCount} records
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trend">
          <Card>
            <CardHeader>
              <CardTitle>Quality Trend (6 Months)</CardTitle>
              <CardDescription>Monthly average data quality score</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.trend && metrics.trend.length > 0 ? (
                <div className="space-y-3">
                  {metrics.trend.map((point, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 w-12">{point.month}</span>
                      <div className="flex-1">
                        <div className="bg-gray-200 rounded-full h-6 relative">
                          <div
                            className={`h-6 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all ${
                              point.score >= 80
                                ? "bg-green-600"
                                : point.score >= 60
                                  ? "bg-blue-600"
                                  : point.score >= 40
                                    ? "bg-amber-600"
                                    : "bg-red-600"
                            }`}
                            style={{ width: `${point.score}%` }}
                          >
                            {point.score > 20 && point.score}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-12 text-right">
                        {point.score}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">Insufficient data for trend</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks">
          <Card>
            <CardHeader>
              <CardTitle>High-Risk Records</CardTitle>
              <CardDescription>
                Records requiring attention or review
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.riskRecords && metrics.riskRecords.length > 0 ? (
                <div className="space-y-3">
                  {metrics.riskRecords.map((record, idx) => (
                    <div key={idx} className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {record.description}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">ID: {record.id.slice(0, 8)}...</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-gray-900">{record.riskScore}</p>
                          <p className="text-xs text-gray-500">risk score</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {record.risks.map((risk, riskIdx) => (
                          <span
                            key={riskIdx}
                            className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded"
                          >
                            {risk}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                  <p className="text-gray-600">No high-risk records detected</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
