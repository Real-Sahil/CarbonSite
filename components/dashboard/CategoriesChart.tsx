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
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CategoryEmission {
  categoryName: string;
  emissions: number;
}

interface CategoriesChartProps {
  data: CategoryEmission[];
  title?: string;
  description?: string;
}

export function CategoriesChart({
  data,
  title = 'Emissions by Category',
  description = 'Top emission sources',
}: CategoriesChartProps) {
  const sortedData = useMemo(() => {
    return [...data]
      .sort((a, b) => b.emissions - a.emissions)
      .slice(0, 10);
  }, [data]);

  const total = useMemo(
    () => sortedData.reduce((sum, item) => sum + item.emissions, 0),
    [sortedData]
  );

  if (sortedData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="h-96 flex items-center justify-center text-gray-500">
          No data available
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = total > 0 ? ((data.emissions / total) * 100).toFixed(1) : '0';
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
          <p className="font-semibold text-sm">{data.categoryName}</p>
          <p className="text-sm">
            {data.emissions.toFixed(2)} t CO₂e ({percentage}%)
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
            <BarChart
              data={sortedData}
              margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="categoryName"
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="#9ca3af"
                label={{ value: 'CO₂e (tonnes)', angle: -90, position: 'insideLeft' }}
                style={{ fontSize: '0.875rem' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="emissions"
                fill="#3b82f6"
                radius={[8, 8, 0, 0]}
                isAnimationActive={true}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
