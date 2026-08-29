'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface EmissionsScopeData {
  name: 'Scope 1' | 'Scope 2' | 'Scope 3';
  value: number;
  percentage: number;
}

interface EmissionsScopeChartProps {
  data: EmissionsScopeData[];
  isLoading?: boolean;
}

const SCOPE_COLORS: Record<string, string> = {
  'Scope 1': '#ef4444',
  'Scope 2': '#f59e0b',
  'Scope 3': '#3b82f6',
};

export function EmissionsScopeChart({ data, isLoading }: EmissionsScopeChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.filter((item) => item.value > 0);
  }, [data]);

  const totalEmissions = useMemo(
    () => chartData.reduce((sum, item) => sum + item.value, 0),
    [chartData]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Emissions by Scope</CardTitle>
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
          <CardTitle>Emissions by Scope</CardTitle>
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
            <CardTitle>Emissions by Scope</CardTitle>
            <CardDescription>Breakdown by GHG Protocol scope</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {totalEmissions.toLocaleString(undefined, { maximumFractionDigits: 0 })} tonnes
            </div>
            <div className="text-xs text-gray-600">Total CO₂e</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name }: { name?: string }) => {
                if (!name) return '';
                const entry = chartData.find((d) => d.name === name);
                const percentage = entry ? entry.percentage : 0;
                return `${name} (${percentage.toFixed(1)}%)`;
              }}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry) => (
                <Cell key={`cell-${entry.name}`} fill={SCOPE_COLORS[entry.name]} />
              ))}
            </Pie>
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
            <Legend />
          </PieChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
          {chartData.map((scope) => (
            <div key={scope.name} className="text-center">
              <div
                className="w-4 h-4 rounded-full mx-auto mb-2"
                style={{ backgroundColor: SCOPE_COLORS[scope.name] }}
              />
              <div className="font-medium text-gray-900">{scope.name}</div>
              <div className="text-sm text-gray-600">
                {scope.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} tonnes
              </div>
              <div className="text-xs text-gray-500">{scope.percentage.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
