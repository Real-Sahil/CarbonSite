'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

interface ForecastData {
  month: string;
  forecast: number;
  lower: number;
  upper: number;
  actual?: number;
}

interface SupplierTableRow {
  supplierId: string;
  overallScore: number;
  trend: 'improving' | 'declining' | 'stable';
  forecastedEmissions?: number;
}

interface SupplierForecast {
  supplierId: string;
  forecastedEmissions: number[];
  confidenceScore: number;
  confidenceInterval: {
    lower: number[];
    upper: number[];
  };
}

export function ForecastChart({ orgId, supplierId }: { orgId: string; supplierId?: string }) {
  const [chartData, setChartData] = useState<ForecastData[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['forecasts', orgId, supplierId],
    queryFn: async () => {
      const url = new URL(`/api/orgs/${orgId}/forecasts`, window.location.origin);
      if (supplierId) url.searchParams.set('supplierId', supplierId);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to fetch forecasts');
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.data?.forecasts) {
      const forecasts = data.data.forecasts as SupplierForecast[];
      if (forecasts.length > 0) {
        const firstForecast = forecasts[0];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const chartData = firstForecast.forecastedEmissions.map((forecast, index) => ({
          month: months[index % 12],
          forecast,
          lower: firstForecast.confidenceInterval.lower[index] || 0,
          upper: firstForecast.confidenceInterval.upper[index] || 0,
        }));
        setChartData(chartData);
      }
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 text-red-500">
        <p>Failed to load forecast data</p>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <p>No forecast data available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis label={{ value: 'CO₂e (tonnes)', angle: -90, position: 'insideLeft' }} />
          <Tooltip
            formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : value)}
            labelFormatter={(label) => `${label}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Forecast"
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="lower"
            stroke="#93c5fd"
            strokeDasharray="5 5"
            name="Lower Bound (95% CI)"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="upper"
            stroke="#93c5fd"
            strokeDasharray="5 5"
            name="Upper Bound (95% CI)"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SupplierScorecard({ orgId }: { orgId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['supplier-analytics', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/orgs/${orgId}/forecasts?type=supplier_quality&limit=5`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  const summary = data?.data?.summary || {};

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className="rounded-lg border p-4 bg-white">
        <div className="text-sm font-medium text-gray-600">Total Suppliers</div>
        <div className="mt-2 text-2xl font-bold">{summary.totalSuppliers || 0}</div>
      </div>

      <div className="rounded-lg border p-4 bg-white">
        <div className="text-sm font-medium text-gray-600">Avg Score</div>
        <div className="mt-2 text-2xl font-bold">{(summary.avgScore || 0).toFixed(0)}</div>
      </div>

      <div className="rounded-lg border p-4 bg-white">
        <div className="text-sm font-medium text-gray-600">Improving</div>
        <div className="mt-2 text-2xl font-bold text-green-600">{summary.improvingCount || 0}</div>
      </div>

      <div className="rounded-lg border p-4 bg-white">
        <div className="text-sm font-medium text-gray-600">Declining</div>
        <div className="mt-2 text-2xl font-bold text-red-600">{summary.declineCount || 0}</div>
      </div>
    </div>
  );
}

export function Scope3SpendForecast({ orgId, supplierId }: { orgId: string; supplierId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['scope3-forecast', orgId, supplierId],
    queryFn: async () => {
      const res = await fetch(`/api/orgs/${orgId}/forecasts?supplierId=${supplierId}`);
      if (!res.ok) throw new Error('Failed to fetch forecast');
      return res.json();
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const forecast = data?.data?.forecasts?.[0];

  if (!forecast) {
    return <p className="text-gray-500">No forecast data</p>;
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const chartData = forecast.forecastedEmissions.map((value: number, index: number) => ({
    month: months[index % 12],
    emissions: value,
  }));

  return (
    <div className="w-full">
      <div className="mb-4">
        <div className="text-sm text-gray-600">Confidence Score</div>
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${Math.round((forecast.forecastConfidence || 0) * 100)}%` }}
            />
          </div>
          <span className="text-sm font-medium">{Math.round((forecast.forecastConfidence || 0) * 100)}%</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis label={{ value: 'CO₂e (tonnes)', angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : value)} />
          <Bar dataKey="emissions" fill="#3b82f6" name="Forecasted Emissions" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VolatilityHeatmap({ orgId }: { orgId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['volatility-heatmap', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/orgs/${orgId}/forecasts?type=supplier_quality&limit=20`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const suppliers: SupplierTableRow[] = data?.data?.forecasts || [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-2 text-left font-medium">Supplier</th>
            <th className="px-4 py-2 text-left font-medium">Score</th>
            <th className="px-4 py-2 text-left font-medium">Trend</th>
            <th className="px-4 py-2 text-left font-medium">Forecast (next month)</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.supplierId} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2">{supplier.supplierId}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-12 rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${supplier.overallScore}%` }}
                    />
                  </div>
                  <span>{Math.round(supplier.overallScore)}</span>
                </div>
              </td>
              <td className="px-4 py-2">
                <span
                  className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                    supplier.trend === 'improving'
                      ? 'bg-green-100 text-green-800'
                      : supplier.trend === 'declining'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {supplier.trend}
                </span>
              </td>
              <td className="px-4 py-2">{supplier.forecastedEmissions?.toFixed(2) || 'N/A'} tonnes</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
