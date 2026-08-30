import { useQuery } from '@tanstack/react-query';

export type AnomalySeverity = 'critical' | 'warning' | 'info';
export type AnomalyType = 'statistical' | 'trend' | 'comparative' | 'quality';

export interface Anomaly {
  id: string;
  severity: AnomalySeverity;
  type: AnomalyType;
  description: string;
  value: number;
  baseline: number;
  deviation: number;
  explanation: string;
  recordId: string;
  facilityId?: string;
  facilityName?: string;
}

export interface AnomaliesSummary {
  period: { id: string; label: string; startDate: string };
  anomalies: Anomaly[];
  totalAnomalies: number;
  summary: {
    critical: number;
    warning: number;
    info: number;
  };
}

export interface AnomaliesFilters {
  periodId?: string;
  severity?: AnomalySeverity;
  anomalyType?: AnomalyType;
  limit?: number;
}

export function useAnomalies(orgId: string, filters?: AnomaliesFilters) {
  const queryParams = new URLSearchParams();
  if (filters?.periodId) queryParams.append('periodId', filters.periodId);
  if (filters?.severity) queryParams.append('severity', filters.severity);
  if (filters?.anomalyType) queryParams.append('type', filters.anomalyType);
  if (filters?.limit) queryParams.append('limit', filters.limit.toString());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['anomalies', orgId, filters],
    queryFn: async () => {
      const response = await fetch(
        `/api/orgs/${orgId}/analytics/anomalies/detailed?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch anomalies: ${response.statusText}`);
      }

      return response.json() as Promise<AnomaliesSummary>;
    },
  });

  // Group anomalies by severity for easy filtering
  const anomaliesBySeverity = {
    critical: data?.anomalies.filter(a => a.severity === 'critical') ?? [],
    warning: data?.anomalies.filter(a => a.severity === 'warning') ?? [],
    info: data?.anomalies.filter(a => a.severity === 'info') ?? [],
  };

  // Group anomalies by type
  const anomaliesByType = {
    statistical: data?.anomalies.filter(a => a.type === 'statistical') ?? [],
    trend: data?.anomalies.filter(a => a.type === 'trend') ?? [],
    comparative: data?.anomalies.filter(a => a.type === 'comparative') ?? [],
    quality: data?.anomalies.filter(a => a.type === 'quality') ?? [],
  };

  return {
    data,
    isLoading,
    error: error instanceof Error ? error.message : null,
    anomalies: data?.anomalies ?? [],
    summary: data?.summary,
    anomaliesBySeverity,
    anomaliesByType,
    refetch,
  };
}
