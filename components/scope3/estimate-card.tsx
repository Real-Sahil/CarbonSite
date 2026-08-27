"use client";

import { AlertCircle, Lightbulb, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Scope3Estimate } from "@/lib/calculation/scope3-estimator";

interface Scope3EstimateCardProps {
  estimate: Scope3Estimate;
  isLoading?: boolean;
  onAccept?: (estimate: Scope3Estimate) => void;
}

export function Scope3EstimateCard({
  estimate,
  isLoading = false,
  onAccept,
}: Scope3EstimateCardProps) {
  const confidence = estimate.confidenceScore * 100;
  const confidenceColor = confidence >= 80 ? "bg-green-500" : confidence >= 60 ? "bg-yellow-500" : "bg-orange-500";

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Scope 3 Estimate
            </CardTitle>
            <CardDescription>{estimate.methodology}</CardDescription>
          </div>
          <Badge variant="outline" className="ml-2">
            {(confidence).toFixed(0)}% confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main estimate */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Estimated Emissions</span>
            <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {estimate.estimatedCo2e.toFixed(1)} kg CO₂e
            </span>
          </div>
          <Progress value={confidence} className="h-2" />
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>Lower: {estimate.estimatedCo2eLower.toFixed(1)} kg</span>
            <span>Upper: {estimate.estimatedCo2eUpper.toFixed(1)} kg</span>
          </div>
        </div>

        {/* Recommended record */}
        <div className="rounded-lg border border-blue-200 bg-white p-3 dark:border-blue-800 dark:bg-blue-900">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Suggested Record</p>
          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
            {estimate.recommendedAmount.toFixed(2)} {estimate.recommendedUnit}
          </p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {estimate.suggestedRecordDescription}
          </p>
        </div>

        {/* Warnings */}
        {estimate.warnings.length > 0 && (
          <Alert className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription className="ml-2 text-xs text-orange-800 dark:text-orange-200">
              {estimate.warnings.join("; ")}
            </AlertDescription>
          </Alert>
        )}

        {/* Category info */}
        <div className="flex items-center justify-between rounded-lg bg-white p-2 dark:bg-blue-900">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Category</span>
          <Badge variant="secondary" className="text-xs">
            {estimate.category}
          </Badge>
        </div>

        {/* Accept button */}
        {onAccept && (
          <button
            onClick={() => onAccept(estimate)}
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            {isLoading ? "Estimating..." : "Use This Estimate"}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

interface Scope3EstimateListProps {
  estimates: Scope3Estimate[];
  isLoading?: boolean;
  onSelect?: (estimate: Scope3Estimate) => void;
}

export function Scope3EstimateList({ estimates, isLoading, onSelect }: Scope3EstimateListProps) {
  if (estimates.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h3 className="text-sm font-semibold">Available Estimates</h3>
      </div>
      {estimates.map((estimate, idx) => (
        <Scope3EstimateCard
          key={idx}
          estimate={estimate}
          isLoading={isLoading}
          onAccept={onSelect}
        />
      ))}
    </div>
  );
}
