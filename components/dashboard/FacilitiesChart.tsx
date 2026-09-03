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
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface FacilityEmission {
  facilityName: string;
  emissions: number;
}

interface FacilitiesChartProps {
  data: FacilityEmission[];
  title?: string;
  description?: string;
}

export function FacilitiesChart({
  data,
  title = 'Emissions by Facility',
  description = 'Facility-level comparison',
}: FacilitiesChartProps) {
  const sortedData = useMemo(() => {
    return [...data]
      .sort((a, b) => b.emissions - a.emissions)
      .slice(0, 15);
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
          No facility data available
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { facilityName: string; emissions: number } }[] }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = total > 0 ? ((data.emissions / total) * 100).toFixed(1) : '0';
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
          <p className="font-semibold text-sm">{data.facilityName}</p>
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
              layout="vertical"
              margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#9ca3af" style={{ fontSize: '0.875rem' }} />
              <YAxis
                dataKey="facilityName"
                type="category"
                stroke="#9ca3af"
                width={140}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="emissions"
                fill="#f59e0b"
                radius={[0, 8, 8, 0]}
                isAnimationActive={true}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
