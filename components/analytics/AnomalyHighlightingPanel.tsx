'use client';

import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronDown, Filter } from 'lucide-react';
import { useAnomalies } from './hooks/useAnomalies';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AnomalyHighlightingPanelProps {
  orgId: string;
  initialPeriodId?: string;
}

const severityConfig: Record<string, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  badge: 'destructive' | 'secondary' | 'outline' | 'default';
}> = {
  critical: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badge: 'destructive',
  },
  warning: {
    icon: AlertCircle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    badge: 'secondary',
  },
  info: {
    icon: Info,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badge: 'outline',
  },
};

export function AnomalyHighlightingPanel({
  orgId,
  initialPeriodId,
}: AnomalyHighlightingPanelProps) {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedAnomalies, setExpandedAnomalies] = useState<Record<string, boolean>>({});

  const { data, isLoading, error, anomalies, summary } = useAnomalies(orgId, {
    periodId: initialPeriodId,
    limit: 100,
  });

  const filteredAnomalies = anomalies.filter(anomaly => {
    if (selectedSeverity !== 'all' && anomaly.severity !== selectedSeverity) {
      return false;
    }
    if (selectedType !== 'all' && anomaly.type !== selectedType) {
      return false;
    }
    return true;
  });

  const toggleAnomalyExpand = (id: string) => {
    setExpandedAnomalies(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-sm text-red-800">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{summary.critical}</div>
              <div className="text-xs text-red-700 font-medium">Critical Issues</div>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">{summary.warning}</div>
              <div className="text-xs text-yellow-700 font-medium">Warnings</div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{summary.info}</div>
              <div className="text-xs text-blue-700 font-medium">Informational</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 block mb-2">
                Severity Filter
              </label>
              <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical Only</SelectItem>
                  <SelectItem value="warning">Warnings Only</SelectItem>
                  <SelectItem value="info">Informational Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 block mb-2">
                Type Filter
              </label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="statistical">Statistical</SelectItem>
                  <SelectItem value="trend">Trend</SelectItem>
                  <SelectItem value="comparative">Comparative</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Anomalies List */}
      <div className="space-y-3">
        {filteredAnomalies.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-gray-600">
                {isLoading ? 'Loading anomalies...' : 'No anomalies found for selected filters'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAnomalies.map(anomaly => {
            const config = severityConfig[anomaly.severity];
            const Icon = config.icon;
            const isExpanded = expandedAnomalies[anomaly.id];

            return (
              <Card
                key={anomaly.id}
                className={`${config.borderColor} cursor-pointer hover:shadow-sm transition-shadow`}
                onClick={() => toggleAnomalyExpand(anomaly.id)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 ${config.color} mt-0.5 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium text-sm">{anomaly.description}</div>
                        <Badge variant={config.badge} className="text-xs">
                          {anomaly.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <div>
                          Value: <span className="font-mono font-medium">{anomaly.value.toFixed(2)}</span>
                        </div>
                        <div>
                          Baseline: <span className="font-mono font-medium">{anomaly.baseline.toFixed(2)}</span>
                        </div>
                        <div>
                          Deviation:{' '}
                          <span
                            className={`font-mono font-medium ${
                              anomaly.deviation > 0 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Facility Name if Available */}
                      {anomaly.facilityName && (
                        <div className="text-xs text-gray-500 mt-2">
                          Facility: <span className="font-medium">{anomaly.facilityName}</span>
                        </div>
                      )}

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className={`mt-3 p-3 rounded-lg ${config.bgColor}`}>
                          <div className="text-xs font-medium text-gray-700 mb-2">Explanation:</div>
                          <p className="text-xs text-gray-700 leading-relaxed">
                            {anomaly.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0 transition-transform ${
                        isExpanded ? '' : '-rotate-90'
                      }`}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}

      {filteredAnomalies.length > 0 && (
        <Card className="bg-gray-50">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-600">
              Showing {filteredAnomalies.length} of {anomalies.length} anomalies
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
