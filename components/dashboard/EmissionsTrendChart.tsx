"use client";

import { useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartExportButton } from "@/components/charts/chart-export-button";
import { Skeleton } from "@/components/ui/skeleton";

interface EmissionDataPoint {
  date: string;
  totalCo2e: number;
  scope1: number;
  scope2: number;
  scope3: number;
}

interface EmissionsTrendChartProps {
  data: EmissionDataPoint[];
  title?: string;
  description?: string;
  isLoading?: boolean;
  error?: string | null;
}

const COLORS = {
  scope1: "#ef4444",
  scope2: "#f59e0b",
  scope3: "#3b82f6",
  total: "#1f2937",
};

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  payload: EmissionDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
        <p className="font-semibold text-sm">{data.date}</p>
        {payload.map((entry, idx) => (
          <p key={idx} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {entry.value.toFixed(2)} t CO₂e
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function EmissionsTrendChart({
  data,
  title = "Emissions Trend",
  description = "Total CO₂e over time",
  isLoading = false,
  error = null,
}: EmissionsTrendChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return { min: 0, max: 0, avg: 0, latest: 0 };
    }

    const values = data.map((d) => d.totalCo2e);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const latest = values[values.length - 1];

    return { min, max, avg, latest };
  }, [data]);

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900">{title}</CardTitle>
          <CardDescription className="text-red-700">{error}</CardDescription>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center text-red-600">
          Failed to load chart data
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center text-gray-500">
          No data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-gray-600">Latest</p>
              <p className="text-2xl font-bold">{stats.latest.toFixed(2)}</p>
              <p className="text-xs text-gray-500">t CO₂e</p>
            </div>
            <ChartExportButton
              chartRef={chartRef}
              filename={`${title.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.png`}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent ref={chartRef} className="space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded">
            <p className="text-xs text-blue-600 font-medium">Average</p>
            <p className="text-lg font-semibold text-blue-900">{stats.avg.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded">
            <p className="text-xs text-green-600 font-medium">Minimum</p>
            <p className="text-lg font-semibold text-green-900">{stats.min.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-3 rounded">
            <p className="text-xs text-red-600 font-medium">Maximum</p>
            <p className="text-lg font-semibold text-red-900">{stats.max.toFixed(2)}</p>
          </div>
        </div>

        {/* Chart tabs */}
        <Tabs defaultValue="trend" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="trend">Trend</TabsTrigger>
            <TabsTrigger value="breakdown">Scope Breakdown</TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="mt-6">
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.total} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS.total} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    style={{ fontSize: "0.875rem" }}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    label={{ value: "CO₂e (tonnes)", angle: -90, position: "insideLeft" }}
                    style={{ fontSize: "0.875rem" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="totalCo2e"
                    stroke={COLORS.total}
                    strokeWidth={2}
                    dot={{ fill: COLORS.total, r: 4 }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="breakdown" className="mt-6">
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorScope1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.scope1} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS.scope1} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorScope2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.scope2} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS.scope2} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorScope3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.scope3} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS.scope3} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    style={{ fontSize: "0.875rem" }}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    label={{ value: "CO₂e (tonnes)", angle: -90, position: "insideLeft" }}
                    style={{ fontSize: "0.875rem" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="scope1"
                    stackId="1"
                    stroke={COLORS.scope1}
                    fill={`url(#colorScope1)`}
                    name="Scope 1"
                  />
                  <Area
                    type="monotone"
                    dataKey="scope2"
                    stackId="1"
                    stroke={COLORS.scope2}
                    fill={`url(#colorScope2)`}
                    name="Scope 2"
                  />
                  <Area
                    type="monotone"
                    dataKey="scope3"
                    stackId="1"
                    stroke={COLORS.scope3}
                    fill={`url(#colorScope3)`}
                    name="Scope 3"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
