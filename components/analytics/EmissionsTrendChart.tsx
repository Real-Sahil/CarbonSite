"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTonnesValue } from "@/components/charts/palette";
import { ProTimeSeries } from "@/components/charts/pro-time-series";

export function EmissionsTrendChart({
  orgId,
  days,
}: {
  orgId: string;
  /** Days shown first; the chart loads the whole period so the user can pan and zoom beyond it. */
  days?: number;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["emissions-trend", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/orgs/${orgId}/analytics/emissions-trend`);
      if (!res.ok) throw new Error("Failed to fetch emissions trend");
      return res.json() as Promise<{ data: { date: string; totalCo2e: number }[] }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (error) return <div className="text-red-600">Failed to load chart</div>;

  // The API returns kg CO2e; the chart shows tonnes.
  const points = (data?.data ?? []).map((r) => ({ time: r.date, value: r.totalCo2e / 1000 }));

  return (
    <ProTimeSeries
      data={points}
      unit="tCO₂e"
      label="Total emissions"
      initialDays={days}
      format={formatTonnesValue}
    />
  );
}
