"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export function FacilityComparisonChart({
  orgId,
  limit = 10,
}: {
  orgId: string;
  limit?: number;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["facility-comparison", orgId, limit],
    queryFn: async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/analytics/facility-comparison?limit=${limit}`
      );
      if (!res.ok) throw new Error("Failed to fetch facility comparison");
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
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 0, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={100}
            stroke="#6b7280"
          />
          <YAxis stroke="#6b7280" label={{ value: "tCO2e", angle: -90, position: "insideLeft" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "0.5rem",
            }}
            formatter={(value) => `${(value as number).toFixed(2)} tCO2e`}
          />
          <Legend />
          <Bar
            dataKey="totalCo2e"
            fill="#3b82f6"
            name="Total Emissions"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
