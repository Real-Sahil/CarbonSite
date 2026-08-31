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

const COLORS = [
  "#f97316",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#fbbf24",
  "#06b6d4",
  "#ec4899",
];

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

  const chartData = data?.data || [];

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
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry: typeof chartData[0], index: number) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => `${(value as number).toFixed(2)} tCO2e`}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex max-h-24 flex-wrap justify-center gap-x-4 gap-y-1 overflow-y-auto px-2">
        {chartData.map((entry: typeof chartData[0], index: number) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs text-[#4B5563]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="whitespace-nowrap">
              {entry.name}: {entry.value.toFixed(1)} tCO2e
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
