"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { AXIS_TICK, GRID_STROKE, NEUTRAL_SERIES_COLOR, formatTonnesValue } from "@/components/charts/palette";

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

  // The API returns kg CO2e; the chart shows tonnes.
  const chartData = ((data?.data ?? []) as Array<Record<string, unknown> & { totalCo2e: number }>).map((r) => ({
    ...r,
    totalCo2e: r.totalCo2e / 1000,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 0, bottom: 60 }}
        >
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={100}
            stroke={GRID_STROKE} tick={AXIS_TICK}
          />
          <YAxis stroke={GRID_STROKE} tick={AXIS_TICK} label={{ value: "tCO₂e", angle: -90, position: "insideLeft" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "0.5rem",
            }}
            formatter={(value) => `${formatTonnesValue(value as number)} tCO₂e`}
          />
          <Bar
            dataKey="totalCo2e"
            fill={NEUTRAL_SERIES_COLOR}
            name="Total Emissions"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
