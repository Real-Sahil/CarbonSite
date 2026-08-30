"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, TrendingUp } from "lucide-react";

interface SummaryMetric {
  label: string;
  value: string;
  change?: number;
  trend?: "up" | "down";
}

export function AnalyticsSummary({ orgId }: { orgId: string }) {
  const { data: scopeData, isLoading: scopeLoading } = useQuery({
    queryKey: ["emissions-by-scope", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/orgs/${orgId}/analytics/emissions-by-scope`);
      if (!res.ok) throw new Error("Failed to fetch emissions by scope");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: trendData } = useQuery({
    queryKey: ["emissions-trend", orgId, 30],
    queryFn: async () => {
      const res = await fetch(`/api/orgs/${orgId}/analytics/emissions-trend?days=30`);
      if (!res.ok) throw new Error("Failed to fetch emissions trend");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const scopeItems = scopeData?.data || [];
  const trendItems = trendData?.data || [];

  const totalEmissions =
    scopeItems.reduce((sum, item) => sum + (item.value || 0), 0) || 0;

  const lastWeekEnd = trendItems.slice(-1)[0]?.totalCo2e || 0;
  const lastWeekStart = trendItems.slice(-8, -1)[0]?.totalCo2e || 0;
  const weekChange = lastWeekStart ? ((lastWeekEnd - lastWeekStart) / lastWeekStart) * 100 : 0;

  const metrics: SummaryMetric[] = [
    {
      label: "Total Emissions",
      value: `${totalEmissions.toFixed(2)} tCO2e`,
      change: weekChange,
      trend: weekChange > 0 ? "up" : "down",
    },
    {
      label: "Scope 1",
      value: `${(scopeItems.find(s => s.scope === 1)?.value || 0).toFixed(2)} tCO2e`,
    },
    {
      label: "Scope 2",
      value: `${(scopeItems.find(s => s.scope === 2)?.value || 0).toFixed(2)} tCO2e`,
    },
    {
      label: "Scope 3",
      value: `${(scopeItems.find(s => s.scope === 3)?.value || 0).toFixed(2)} tCO2e`,
    },
  ];

  if (scopeLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <div
          key={index}
          className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <p className="text-sm font-medium text-gray-600">{metric.label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{metric.value}</p>
          {metric.change !== undefined && (
            <div className="flex items-center gap-2 mt-3">
              {metric.trend === "up" ? (
                <TrendingUp className="h-4 w-4 text-red-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-600" />
              )}
              <span
                className={`text-xs font-medium ${
                  metric.trend === "up" ? "text-red-600" : "text-green-600"
                }`}
              >
                {metric.trend === "up" ? "+" : ""}
                {metric.change.toFixed(1)}% vs last week
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
