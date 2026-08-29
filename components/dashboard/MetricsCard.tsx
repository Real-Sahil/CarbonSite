'use client';

import { ReactNode } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricsCardProps {
  title: string;
  value: number | string;
  unit?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  sparklineData?: Array<{ x: number; y: number }>;
  status?: 'good' | 'warning' | 'critical';
}

const statusConfig = {
  good: { bg: 'bg-green-50', text: 'text-green-900' },
  warning: { bg: 'bg-yellow-50', text: 'text-yellow-900' },
  critical: { bg: 'bg-red-50', text: 'text-red-900' },
};

export function MetricsCard({
  title,
  value,
  unit,
  icon,
  trend,
  sparklineData,
  status = 'good',
}: MetricsCardProps) {
  const config = statusConfig[status];

  return (
    <Card className={`${config.bg} border-0`}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className={`text-sm font-medium ${config.text} opacity-75`}>{title}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className={`text-3xl font-bold ${config.text}`}>
                  {typeof value === 'number'
                    ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
                    : value}
                </span>
                {unit && <span className={`text-sm ${config.text} opacity-75`}>{unit}</span>}
              </div>
            </div>
            {icon && <div className={`${config.text} opacity-50`}>{icon}</div>}
          </div>

          {trend && (
            <div className="flex items-center gap-2 text-sm">
              {trend.isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span
                className={trend.isPositive ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}
              >
                {Math.abs(trend.value)}%
              </span>
              <span className={`${config.text} opacity-75`}>{trend.label}</span>
            </div>
          )}

          {sparklineData && sparklineData.length > 0 && (
            <div className="mt-4 -mx-6 -mb-6">
              <ResponsiveContainer width="100%" height={50}>
                <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={status === 'good' ? '#10b981' : status === 'warning' ? '#f59e0b' : '#ef4444'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={status === 'good' ? '#10b981' : status === 'warning' ? '#f59e0b' : '#ef4444'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="y"
                    stroke={status === 'good' ? '#10b981' : status === 'warning' ? '#f59e0b' : '#ef4444'}
                    fill={`url(#gradient-${title})`}
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
