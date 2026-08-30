'use client';

import React, { useState } from 'react';
import { ChevronDown, Filter, RotateCcw, TrendingUp } from 'lucide-react';
import { useDrillDown } from './hooks/useDrillDown';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

interface DrillDownDashboardProps {
  orgId: string;
  initialPeriodId?: string;
  onFilterChange?: (filters: Record<string, unknown>) => void;
}

export function DrillDownDashboard({
  orgId,
  initialPeriodId,
  onFilterChange,
}: DrillDownDashboardProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    scope: true,
    category: true,
    facility: true,
  });

  const { data, isLoading, error, filters, updateFilters, clearFilters } = useDrillDown(
    orgId,
    initialPeriodId ? { periodId: initialPeriodId } : undefined
  );

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleScopeFilter = (scope: number) => {
    const currentScopes = filters.scopes || [];
    const newScopes = currentScopes.includes(scope)
      ? currentScopes.filter(s => s !== scope)
      : [...currentScopes, scope];
    updateFilters({ scopes: newScopes.length > 0 ? newScopes : undefined });
    onFilterChange?.({ ...filters, scopes: newScopes });
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

  const hasActiveFilters = Boolean(
    filters.scopes?.length ||
    filters.categoryIds?.length ||
    filters.facilityIds?.length
  );

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <CardTitle className="text-base">Analytics Filters</CardTitle>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Drill-Down Sections */}
      <div className="space-y-3">
        {/* Scope Breakdown */}
        {data?.byScope && (
          <Card>
            <CardHeader
              className="pb-3 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSection('scope')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Scope Breakdown
                  {filters.scopes?.length ? (
                    <Badge variant="secondary" className="ml-2">
                      {filters.scopes.length} selected
                    </Badge>
                  ) : null}
                </CardTitle>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    expandedSections.scope ? '' : '-rotate-90'
                  }`}
                />
              </div>
            </CardHeader>

            {expandedSections.scope && (
              <CardContent className="space-y-2">
                {data.byScope.map(item => (
                  <div
                    key={`scope-${item.scope}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleScopeFilter(item.scope || 0)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded border border-gray-300 flex items-center justify-center">
                        {filters.scopes?.includes(item.scope || 0) && (
                          <div className="w-2 h-2 bg-blue-600 rounded" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          Scope {item.scope || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.percentage?.toFixed(1)}% of total
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-sm">
                        {(item.totalCo2e / 1000).toFixed(2)} tCO₂e
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )}

        {/* Category Breakdown */}
        {data?.byCategory && (
          <Card>
            <CardHeader
              className="pb-3 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSection('category')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  Category Breakdown
                  {filters.categoryIds?.length ? (
                    <Badge variant="secondary" className="ml-2">
                      {filters.categoryIds.length} selected
                    </Badge>
                  ) : null}
                </CardTitle>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    expandedSections.category ? '' : '-rotate-90'
                  }`}
                />
              </div>
            </CardHeader>

            {expandedSections.category && (
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {data.byCategory.map(item => (
                    <div
                      key={item.categoryId}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <div className="font-medium text-sm">{item.categoryName}</div>
                        <div className="text-xs text-gray-500">
                          {item.recordCount} records
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm">
                          {(item.totalCo2e / 1000).toFixed(2)} tCO₂e
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Facility Breakdown */}
        {data?.byFacility && (
          <Card>
            <CardHeader
              className="pb-3 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSection('facility')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  Facility Breakdown
                  {filters.facilityIds?.length ? (
                    <Badge variant="secondary" className="ml-2">
                      {filters.facilityIds.length} selected
                    </Badge>
                  ) : null}
                </CardTitle>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    expandedSections.facility ? '' : '-rotate-90'
                  }`}
                />
              </div>
            </CardHeader>

            {expandedSections.facility && (
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {data.byFacility.map(item => (
                    <div
                      key={item.facilityId}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <div className="font-medium text-sm">{item.facilityName}</div>
                        <div className="text-xs text-gray-500">
                          {item.location || 'No location'} | {item.recordCount} records
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm">
                          {(item.totalCo2e / 1000).toFixed(2)} tCO₂e
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Period Comparison */}
        {data?.comparison && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-sm">Period Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs text-gray-600">Previous Period</div>
                  <div className="text-lg font-semibold">
                    {(data.comparison.previousCo2e / 1000).toFixed(2)} tCO₂e
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-600">Current Period</div>
                  <div className="text-lg font-semibold">
                    {(data.comparison.currentCo2e / 1000).toFixed(2)} tCO₂e
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t">
                <Badge
                  variant={data.comparison.changeDirection === 'increase' ? 'destructive' : 'default'}
                >
                  {data.comparison.changeDirection === 'increase' ? '↑' : '↓'}{' '}
                  {data.comparison.changePercent}% {data.comparison.changeDirection}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Contributors */}
        {data?.topContributors && data.topContributors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Top Contributors</CardTitle>
              <CardDescription>Highest emission records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.topContributors.slice(0, 5).map((contributor, idx) => (
                  <div
                    key={contributor.id}
                    className="flex items-start justify-between p-3 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <div>
                      <div className="font-medium">#{idx + 1}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {contributor.facility.name} • {contributor.category.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {(contributor.normalizedAmount / 1000).toFixed(2)} tCO₂e
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}
    </div>
  );
}
