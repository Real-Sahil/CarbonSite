'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ScopeData {
  scope1: number;
  scope2: number;
  scope3: number;
}

interface ScopeBreakdownChartProps {
  data: ScopeData;
  title?: string;
  description?: string;
}

const COLORS = {
  scope1: '#ef4444',
  scope2: '#f59e0b',
  scope3: '#3b82f6',
};

export function ScopeBreakdownChart({
  data,
  title = 'Emissions by Scope',
  description = 'Distribution across Scope 1, 2, and 3',
}: ScopeBreakdownChartProps) {
  const chartData = useMemo(() => {
    const total = data.scope1 + data.scope2 + data.scope3;

    return [
      {
        name: 'Scope 1',
        value: data.scope1,
        percentage: total > 0 ? ((data.scope1 / total) * 100).toFixed(1) : '0',
      },
      {
        name: 'Scope 2',
        value: data.scope2,
        percentage: total > 0 ? ((data.scope2 / total) * 100).toFixed(1) : '0',
      },
      {
        name: 'Scope 3',
        value: data.scope3,
        percentage: total > 0 ? ((data.scope3 / total) * 100).toFixed(1) : '0',
      },
    ].filter((item) => item.value > 0);
  }, [data]);

  const total = useMemo(
    () => data.scope1 + data.scope2 + data.scope3,
    [data]
  );

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center text-gray-500">
          No emissions data
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { name: string; value: number; percentage: number } }[] }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
          <p className="font-semibold text-sm">{data.name}</p>
          <p className="text-sm">
            {data.value.toFixed(2)} t CO₂e ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold">{total.toFixed(2)}</p>
            <p className="text-xs text-gray-500">t CO₂e</p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => {
                  const pct = total > 0 ? ((value / total) * 100).toFixed(0) : '0';
                  return `${name} ${pct}%`;
                }}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill={COLORS.scope1} />
                <Cell fill={COLORS.scope2} />
                <Cell fill={COLORS.scope3} />
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Detail breakdown */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS.scope1 }}
              />
              <span className="text-sm text-gray-700">Scope 1</span>
            </div>
            <span className="font-semibold text-sm">{data.scope1.toFixed(2)} t</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS.scope2 }}
              />
              <span className="text-sm text-gray-700">Scope 2</span>
            </div>
            <span className="font-semibold text-sm">{data.scope2.toFixed(2)} t</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS.scope3 }}
              />
              <span className="text-sm text-gray-700">Scope 3</span>
            </div>
            <span className="font-semibold text-sm">{data.scope3.toFixed(2)} t</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
