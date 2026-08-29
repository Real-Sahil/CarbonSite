'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface EmissionsCategoryData {
  category: string;
  co2e: number;
  percentage: number;
}

interface EmissionsCategoryChartProps {
  data: EmissionsCategoryData[];
  isLoading?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function EmissionsCategoryChart({ data, isLoading }: EmissionsCategoryChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.sort((a, b) => b.co2e - a.co2e).slice(0, 10);
  }, [data]);

  const totalEmissions = useMemo(
    () => chartData.reduce((sum, item) => sum + item.co2e, 0),
    [chartData]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Emissions by Category</CardTitle>
          <CardDescription>Loading data...</CardDescription>
        </CardHeader>
        <CardContent className="h-80 bg-gray-50 rounded animate-pulse" />
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Emissions by Category</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center text-gray-500">
          No emissions data to display
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Emissions by Category</CardTitle>
            <CardDescription>Top 10 emission sources</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {totalEmissions.toLocaleString(undefined, { maximumFractionDigits: 0 })} tonnes
            </div>
            <div className="text-xs text-gray-600">CO₂e</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="category"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              label={{ value: 'CO₂e (tonnes)', angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
              }}
              formatter={(value) => {
                if (typeof value === 'number') {
                  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
                }
                return '0';
              }}
            />
            <Bar dataKey="co2e" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
