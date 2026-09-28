"use client";

import { useQuery } from "@tanstack/react-query";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTonnesValue, scopeColor } from "@/components/charts/palette";

interface ScopeRow {
  scope: number;
  name: string;
  /** kg CO2e from the API. */
  value: number;
}

export function EmissionsByScopeChart({ orgId }: { orgId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["emissions-by-scope", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/orgs/${orgId}/analytics/emissions-by-scope`);
      if (!res.ok) throw new Error("Failed to fetch emissions by scope");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (error) return <div className="text-red-600">Failed to load chart</div>;

  // The API returns kg CO2e; the chart shows tonnes.
  const chartData = ((data?.data ?? []) as ScopeRow[]).map((r) => ({ ...r, value: r.value / 1000 }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${formatTonnesValue(value as number)} tCO₂e`}
            outerRadius={120}
            stroke="#ffffff"
            strokeWidth={2}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell key={entry.scope} fill={scopeColor(entry.scope)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => `${formatTonnesValue(value as number)} tCO₂e`}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
