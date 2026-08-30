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

const COLORS = ["#f97316", "#3b82f6", "#10b981"];

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

  const chartData = data?.data || [];

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value.toFixed(2)} tCO2e`}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => `${(value as number).toFixed(2)} tCO2e`}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
