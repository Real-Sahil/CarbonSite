"use client";

import { useQuery } from "@tanstack/react-query";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTonnesValue, scopeColor } from "@/components/charts/palette";

interface CategoryRow {
  name: string;
  code: string;
  scope: number;
  /** kg CO2e from the API. */
  value: number;
}

export function CategoryBreakdownChart({ orgId }: { orgId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["category-breakdown", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/orgs/${orgId}/analytics/category-breakdown`);
      if (!res.ok) throw new Error("Failed to fetch category breakdown");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (error) return <div className="text-red-600">Failed to load chart</div>;

  // The API returns kg CO2e; the chart shows tonnes. Slices take their scope's
  // colour (categories are too many to give each its own distinguishable hue).
  const chartData = ((data?.data ?? []) as CategoryRow[]).map((r) => ({ ...r, value: r.value / 1000 }));

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="70%">
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={1}
            stroke="#ffffff"
            strokeWidth={2}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell key={entry.code} fill={scopeColor(entry.scope)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => `${formatTonnesValue(value as number)} tCO₂e`}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex max-h-24 flex-wrap justify-center gap-x-4 gap-y-1 overflow-y-auto px-2">
        {chartData.map((entry) => (
          <div key={entry.code} className="flex items-center gap-1.5 text-xs text-[#4B5563]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: scopeColor(entry.scope) }}
            />
            <span className="whitespace-nowrap">
              {entry.name}: {formatTonnesValue(entry.value, 1)} tCO₂e
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
