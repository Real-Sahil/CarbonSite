"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Loader2, TrendingUp, TrendingDown } from "lucide-react";

interface CausalAnalysisResult {
  id: string;
  question: string;
  treatment: string;
  outcome: string;
  status: "queued" | "running" | "completed" | "failed";
  treatmentEffect?: number;
  confidenceIntervalLower?: number;
  confidenceIntervalUpper?: number;
  pValue?: number;
  robustnessToUnmeasuredConf?: number;
  sampleSize?: number;
  method?: string;
  resultSummary?: string;
  errorMessage?: string;
  causalGraph?: Record<string, unknown>;
  createdAt: string;
}

interface CausalAnalysisResultsProps {
  analysisId: string;
  orgId: string;
}

export function CausalAnalysisResults({
  analysisId,
  orgId,
}: CausalAnalysisResultsProps) {
  const [result, setResult] = useState<CausalAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);

  const loadResult = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/orgs/${orgId}/causal-analyses/${analysisId}`
      );
      if (!response.ok) throw new Error("Failed to load result");

      const data = await response.json();
      setResult(data);
    } catch {
      // Handle error silently, can still show cached result
    } finally {
      setLoading(false);
    }
  }, [orgId, analysisId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadResult();
    const interval = setInterval(loadResult, 3000);
    return () => clearInterval(interval);
  }, [loadResult]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!result) {
    return <Alert><AlertDescription>No result found</AlertDescription></Alert>;
  }

  if (result.status === "failed") {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {result.errorMessage || "Analysis failed"}
        </AlertDescription>
      </Alert>
    );
  }

  if (result.status === "running" || result.status === "queued") {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>
          {result.status === "queued"
            ? "Analysis is queued and will start soon..."
            : "Analysis is running..."}
        </AlertDescription>
      </Alert>
    );
  }

  const effectSize = result.treatmentEffect ?? 0;
  const isSignificant = (result.pValue ?? 1) < 0.05;
  const isPositiveEffect = effectSize > 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Summary</CardTitle>
          <CardDescription>{result.question}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.resultSummary ? (
            <p className="text-sm whitespace-pre-wrap">{result.resultSummary}</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Treatment Effect */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Treatment Effect (ATE)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">
                {isPositiveEffect ? "+" : ""}{effectSize.toFixed(2)}
              </div>
              {isPositiveEffect ? (
                <TrendingUp className="h-4 w-4 text-red-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average treatment effect on outcome
            </p>
          </CardContent>
        </Card>

        {/* P-Value */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">P-Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">
                {(result.pValue ?? 1).toFixed(4)}
              </div>
              {isSignificant ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-gray-400" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isSignificant ? "Statistically significant" : "Not significant at p < 0.05"}
            </p>
          </CardContent>
        </Card>

        {/* Confidence Interval */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">95% CI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              [{(result.confidenceIntervalLower ?? 0).toFixed(2)},{" "}
              {(result.confidenceIntervalUpper ?? 0).toFixed(2)}]
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Confidence interval range
            </p>
          </CardContent>
        </Card>

        {/* Robustness */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Robustness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((result.robustnessToUnmeasuredConf ?? 0) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Resistant to unmeasured confounding
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Treatment Variable</p>
              <p className="font-medium">{result.treatment}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Outcome Variable</p>
              <p className="font-medium">{result.outcome}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Sample Size</p>
              <p className="font-medium">{result.sampleSize?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Method</p>
              <p className="font-medium">{result.method}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interpretation */}
      <Card>
        <CardHeader>
          <CardTitle>Interpretation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-semibold mb-1">Effect Direction</p>
            <p className="text-muted-foreground">
              {isPositiveEffect
                ? "The treatment is associated with an increase in the outcome variable."
                : "The treatment is associated with a decrease in the outcome variable."}
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">Statistical Significance</p>
            <p className="text-muted-foreground">
              {isSignificant
                ? "The effect is statistically significant at the 0.05 level, meaning it's unlikely to have occurred by chance."
                : "The effect is not statistically significant. It may have occurred by random chance."}
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">Causal Robustness</p>
            <p className="text-muted-foreground">
              The analysis accounts for the risk of unmeasured confounders. A higher robustness score
              (closer to 100%) indicates greater confidence that the relationship is causal.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
