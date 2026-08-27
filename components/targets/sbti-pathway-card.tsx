"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingDown, Target, AlertCircle } from "lucide-react";
import type { SBTiPathwayResult } from "@/lib/calculation/sbti-calculator";

interface SBTiPathwayCardProps {
  pathway: SBTiPathwayResult;
}

export function SBTiPathwayCard({ pathway }: SBTiPathwayCardProps) {
  const isAmbitious = pathway.pathway === "1.5C";
  const reductionPercentPerYear = pathway.annualReductionRate;

  return (
    <div className="space-y-4">
      <Card className={isAmbitious ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950" : "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950"}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Science-Based Target ({pathway.pathway})
              </CardTitle>
              <CardDescription>{pathway.pathwayDescription}</CardDescription>
            </div>
            <Badge variant={isAmbitious ? "default" : "secondary"} className="ml-2">
              {pathway.pathway}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Main Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Baseline</p>
              <p className="text-lg font-bold">{(pathway.baselineEmissions / 1000).toFixed(1)} t</p>
              <p className="text-xs text-gray-500">{pathway.baselineYear}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Target</p>
              <p className="text-lg font-bold">{(pathway.targetEmissions / 1000).toFixed(1)} t</p>
              <p className="text-xs text-gray-500">{pathway.targetYear}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Reduction</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">-{pathway.totalReductionPercent}%</p>
              <p className="text-xs text-gray-500">{(pathway.totalReductionNeeded / 1000).toFixed(0)} t CO₂e</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Annual Rate</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{reductionPercentPerYear}%</p>
              <p className="text-xs text-gray-500">{pathway.yearsToTarget} years</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Annual Reduction Targets</h4>
            <div className="space-y-2">
              {pathway.annualTargets.slice(0, 5).map((target) => (
                <div key={target.year} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{target.year}</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {(target.targetEmissions / 1000).toFixed(1)} t
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full bg-green-500"
                      style={{
                        width: `${Math.max(5, (target.targetEmissions / pathway.baselineEmissions) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>-{target.annualReductionRate.toFixed(1)}%</span>
                    <span>-{target.cumulativeReduction.toFixed(0)}% cumulative</span>
                  </div>
                </div>
              ))}
            </div>
            {pathway.annualTargets.length > 5 && (
              <p className="text-xs text-gray-500">
                ... and {pathway.annualTargets.length - 5} more years
              </p>
            )}
          </div>

          {/* Recommendations */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Recommendations</h4>
            <ul className="space-y-2">
              {pathway.recommendations.map((rec, idx) => (
                <li key={idx} className="flex gap-2 text-xs">
                  <TrendingDown className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Ambition Alert */}
          {isAmbitious && (
            <Alert className="border-green-200 bg-white dark:border-green-900 dark:bg-green-900">
              <AlertCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="ml-2 text-xs text-green-800 dark:text-green-200">
                1.5°C pathway requires innovation (carbon capture, alternative fuels) alongside operational improvements. This is the most ambitious commitment.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SBTiComparisonProps {
  pathways: SBTiPathwayResult[];
}

export function SBTiComparison({ pathways }: SBTiComparisonProps) {
  if (pathways.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pathway Comparison</CardTitle>
        <CardDescription>Compare reduction requirements across climate scenarios</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pathways.map((pathway) => (
            <div key={pathway.pathway} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{pathway.pathway}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {pathway.totalReductionPercent}% reduction at {pathway.annualReductionRate}%/year
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{(pathway.targetEmissions / 1000).toFixed(1)} t</p>
                <p className="text-xs text-gray-500">by {pathway.targetYear}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
