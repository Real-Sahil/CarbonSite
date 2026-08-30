import { useCallback, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

export interface DrillDownFilters {
  periodId?: string;
  scopes?: number[];
  categoryIds?: string[];
  facilityIds?: string[];
  businessUnitIds?: string[];
  includeDistribution?: boolean;
  includeTopContributors?: boolean;
  includeComparison?: boolean;
  comparisonPeriodId?: string;
  limit?: number;
  offset?: number;
}

export interface DrillDownDimension {
  scope?: number;
  categoryId?: string;
  categoryName?: string;
  facilityId?: string;
  facilityName?: string;
  location?: string;
  totalCo2e: number;
  scope1?: number;
  scope2?: number;
  scope3?: number;
  recordCount?: number;
  percentage?: number;
}

export interface TopContributor {
  id: string;
  sourceDescription: string;
  normalizedAmount: number;
  category: { id: string; name: string };
  facility: { id: string; name: string };
}

export interface DrillDownResult {
  period: { id: string; label: string; startDate: string };
  dimensions: string[];
  byScope?: DrillDownDimension[];
  byCategory?: DrillDownDimension[];
  byFacility?: DrillDownDimension[];
  topContributors?: TopContributor[];
  comparison?: {
    previousCo2e: number;
    currentCo2e: number;
    changePercent: string;
    changeDirection: 'increase' | 'decrease';
  };
}

export function useDrillDown(orgId: string, initialFilters?: DrillDownFilters) {
  const [filters, setFilters] = useState<DrillDownFilters>(initialFilters || {});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['drill-down', orgId, JSON.stringify(filters)],
    queryFn: async () => {
      const response = await fetch(`/api/orgs/${orgId}/analytics/drill-down`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions: ['scope', 'category', 'facility'],
          ...filters,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Drill-down query failed: ${response.statusText}`
        );
      }

      const result = await response.json();
      if (!result.period) {
        throw new Error('Invalid drill-down response: missing period data');
      }
      return result as DrillDownResult;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
    retry: 1,
    retryDelay: 1000,
  });

  const updateFilters = useCallback((newFilters: Partial<DrillDownFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
    data,
    isLoading,
    error: error instanceof Error ? error.message : null,
    filters,
    updateFilters,
    clearFilters,
    refetch,
  };
}
