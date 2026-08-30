"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { format } from "date-fns";

interface Prediction {
  date: string;
  forecast: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

interface ForecastResult {
  id: string;
  forecastType: string;
  targetPeriodStart: string;
  targetPeriodEnd: string;
  predictions: Prediction[];
  accuracy: { mape: number };
  method: string;
  trainingDataPoints: number;
  generatedAt: string;
  validUntil: string;
  isValid: boolean;
}

interface ForecastExplanation {
  summary: string;
  components: Record<string, number>;
  featureImportance: Array<{
    name: string;
    contribution: number;
    direction: string;
    significance: string;
    explanation: string;
  }>;
  confidenceFactors: Record<string, number>;
}

interface ForecastResultsProps {
  forecastId: string;
  orgId: string;
}

export function ForecastResults({ forecastId, orgId }: ForecastResultsProps) {
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [explanation, setExplanation] = useState<ForecastExplanation | null>(null);
  const [loading, setLoading] = useState(true);

  const loadResult = useCallback(async () => {
    try {
      const [resultRes, explainRes] = await Promise.all([
        fetch(`/api/orgs/${orgId}/forecasts/${forecastId}`),
        fetch(`/api/orgs/${orgId}/forecasts/${forecastId}/explain`),
      ]);

      if (!resultRes.ok) throw new Error("Failed to load forecast");

      const data = await resultRes.json();
      setResult(data);

      if (explainRes.ok) {
        const explainData = await explainRes.json();
        setExplanation(explainData.explanation);
      }
    } catch {
      // Handle error silently, can still show cached result
    } finally {
      setLoading(false);
    }
  }, [orgId, forecastId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadResult();
    const interval = setInterval(loadResult, 30000);
    return () => clearInterval(interval);
  }, [loadResult]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!result) {
    return <Alert><AlertDescription>No forecast found</AlertDescription></Alert>;
  }

  if (!result.isValid) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>This forecast has expired. Generate a new one.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast Summary</CardTitle>
          <CardDescription>
            {result.forecastType === "emissions"
              ? "Emissions forecast with confidence interval"
              : result.forecastType === "supplier_quality"
                ? "Supplier quality score forecast"
                : "Anomaly rate forecast"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Method</p>
              <p className="font-medium">{result.method}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Accuracy (MAPE)</p>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <p className="font-medium">{result.accuracy.mape.toFixed(2)}%</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Training Data</p>
              <p className="font-medium">{result.trainingDataPoints} points</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Forecast Period</p>
              <p className="font-medium text-sm">
                {format(new Date(result.targetPeriodStart), "MMM d")} -{" "}
                {format(new Date(result.targetPeriodEnd), "MMM d")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forecast Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={result.predictions}>
              <defs>
                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => format(new Date(date), "MMM d")}
              />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #e5e7eb",
                }}
                formatter={(value) => {
                  if (typeof value === 'number') return [value.toFixed(2), "Forecast"];
                  return [String(value || ""), "Forecast"];
                }}
              />
              <Area
                type="monotone"
                dataKey="forecast"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorForecast)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Confidence Interval */}
      <Card>
        <CardHeader>
          <CardTitle>Confidence Interval</CardTitle>
          <CardDescription>
            95% confidence bounds for forecast predictions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={result.predictions}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => format(new Date(date), "MMM d")}
              />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #e5e7eb",
                }}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Forecast"
              />
              <Line
                type="monotone"
                dataKey="lowerBound"
                stroke="#9ca3af"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="Lower Bound"
              />
              <Line
                type="monotone"
                dataKey="upperBound"
                stroke="#9ca3af"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="Upper Bound"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Explainability */}
      {explanation && (
        <Card>
          <CardHeader>
            <CardTitle>Why This Forecast?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold mb-2">Summary</p>
              <p className="text-sm text-muted-foreground">
                {explanation.summary}
              </p>
            </div>

            {explanation.featureImportance.length > 0 && (
              <div>
                <p className="font-semibold mb-2">Key Drivers</p>
                <div className="space-y-2">
                  {explanation.featureImportance.map((feature) => (
                    <div key={feature.name} className="text-sm p-2 bg-muted rounded">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium">{feature.name}</p>
                        <span className="text-xs bg-white px-2 py-1 rounded">
                          {(feature.contribution * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {feature.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {explanation.components && Object.keys(explanation.components).length > 0 && (
              <div>
                <p className="font-semibold mb-2">Components</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {Object.entries(explanation.components).map(([name, value]) => (
                    <div key={name} className="text-sm p-2 bg-muted rounded text-center">
                      <p className="text-muted-foreground text-xs capitalize">{name}</p>
                      <p className="font-medium">{(value * 100).toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Generated</span>
            <span>{format(new Date(result.generatedAt), "MMM d, yyyy HH:mm")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valid Until</span>
            <span>{format(new Date(result.validUntil), "MMM d, yyyy")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Method</span>
            <span className="font-medium">{result.method}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Training Data Points</span>
            <span>{result.trainingDataPoints}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
