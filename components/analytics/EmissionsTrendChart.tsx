"use client";

import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export function EmissionsTrendChart({
  orgId,
  days = 30,
}: {
  orgId: string;
  days?: number;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["emissions-trend", orgId, days],
    queryFn: async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/analytics/emissions-trend?days=${days}`
      );
      if (!res.ok) throw new Error("Failed to fetch emissions trend");
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
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" stroke="#6b7280" />
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
          <Line
            type="monotone"
            dataKey="totalCo2e"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ fill: "#f97316", r: 4 }}
            activeDot={{ r: 6 }}
            name="Total Emissions"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
