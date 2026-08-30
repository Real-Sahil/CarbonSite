import { renderHook, waitFor, act } from '@testing-library/react';
import { useDrillDown } from '../useDrillDown';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';

const createMockResponse = (data: any, ok = true, status = 200): Response => {
  return new Response(JSON.stringify(data), {
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  });
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useDrillDown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty filters and loading state', () => {
    const { result } = renderHook(() => useDrillDown('org-123'), {
      wrapper: createWrapper(),
    });

    expect(result.current.filters).toEqual({});
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should fetch drill-down data with POST request', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          dimensions: ['scope', 'category', 'facility'],
          byScope: [
            {
              scope: 1,
              totalCo2e: 1000,
              percentage: 50,
            },
          ],
          byCategory: [],
          byFacility: [],
          topContributors: [],
        })
      )
    );

    const { result } = renderHook(() => useDrillDown('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.byScope).toBeDefined();
  });

  it('should handle initial filters', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          dimensions: ['scope', 'category', 'facility'],
          byScope: [],
          byCategory: [],
          byFacility: [],
        })
      )
    );

    const initialFilters = {
      periodId: 'p1',
      scopes: [1, 2],
      categoryIds: ['cat1'],
    };

    const { result } = renderHook(() => useDrillDown('org-123', initialFilters), {
      wrapper: createWrapper(),
    });

    expect(result.current.filters).toEqual(initialFilters);
  });

  it('should update filters', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          dimensions: ['scope', 'category', 'facility'],
          byScope: [],
          byCategory: [],
          byFacility: [],
        })
      )
    );

    const { result } = renderHook(() => useDrillDown('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.updateFilters({ scopes: [1] });
    });

    await waitFor(() => {
      expect(result.current.filters.scopes).toEqual([1]);
    });
  });

  it('should clear filters', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          dimensions: ['scope', 'category', 'facility'],
          byScope: [],
          byCategory: [],
          byFacility: [],
        })
      )
    );

    const { result } = renderHook(
      () => useDrillDown('org-123', { scopes: [1, 2] }),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.clearFilters();
    });

    await waitFor(() => {
      expect(result.current.filters).toEqual({});
    });
  });

  it('should include period comparison data', async () => {
    const mockData = {
      period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
      dimensions: ['scope', 'category', 'facility'],
      byScope: [],
      byCategory: [],
      byFacility: [],
      comparison: {
        previousCo2e: 5000,
        currentCo2e: 6000,
        changePercent: '+20',
        changeDirection: 'increase' as const,
      },
      topContributors: [],
    };

    global.fetch = vi.fn(() =>
      Promise.resolve(createMockResponse(mockData))
    );

    const { result } = renderHook(() => useDrillDown('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.comparison).toBeDefined();
      expect(result.current.data?.comparison?.changeDirection).toBe('increase');
    });
  });

  it('should handle top contributors', async () => {
    const mockData = {
      period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
      dimensions: ['scope', 'category', 'facility'],
      byScope: [],
      byCategory: [],
      byFacility: [],
      topContributors: [
        {
          id: 'rec1',
          sourceDescription: 'Facility A electricity',
          normalizedAmount: 500,
          category: { id: 'cat1', name: 'Electricity' },
          facility: { id: 'fac1', name: 'Facility A' },
        },
      ],
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    );

    const { result } = renderHook(() => useDrillDown('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.topContributors).toHaveLength(1);
      expect(result.current.data?.topContributors?.[0].facility.name).toBe(
        'Facility A'
      );
    });
  });

  it('should handle API errors', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        statusText: 'Internal Server Error',
      }) as any
    );

    const { result } = renderHook(() => useDrillDown('org-123'), {
      wrapper: createWrapper(),
    });

    // Wait for the error to be captured and error state to be set
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Error should be captured as a string from the Error message
    expect(result.current.error).toBeTruthy();
    expect(result.current.error).toContain('Drill-down query failed');
  });

  it('should refetch data', async () => {
    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
            dimensions: ['scope', 'category', 'facility'],
            byScope: [],
            byCategory: [],
            byFacility: [],
          }),
      });
    });

    const { result } = renderHook(() => useDrillDown('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialCallCount = callCount;

    result.current.refetch();

    await waitFor(() => {
      expect(callCount).toBeGreaterThan(initialCallCount);
    });
  });

  it('should merge multiple filter updates', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
            dimensions: ['scope', 'category', 'facility'],
            byScope: [],
            byCategory: [],
            byFacility: [],
          }),
      })
    );

    const { result } = renderHook(() => useDrillDown('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.updateFilters({ scopes: [1] });
      result.current.updateFilters({ categoryIds: ['cat1'] });
    });

    await waitFor(() => {
      expect(result.current.filters.scopes).toEqual([1]);
      expect(result.current.filters.categoryIds).toEqual(['cat1']);
    });
  });

  it('should handle scope breakdown with percentage calculation', async () => {
    const mockData = {
      period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
      dimensions: ['scope', 'category', 'facility'],
      byScope: [
        {
          scope: 1,
          totalCo2e: 2000,
          percentage: 40,
        },
        {
          scope: 2,
          totalCo2e: 3000,
          percentage: 60,
        },
      ],
      byCategory: [],
      byFacility: [],
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    );

    const { result } = renderHook(() => useDrillDown('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.byScope).toHaveLength(2);
      expect(result.current.data?.byScope?.[0].percentage).toBe(40);
      expect(result.current.data?.byScope?.[1].percentage).toBe(60);
    });
  });

  it('should handle facility breakdown with location', async () => {
    const mockData = {
      period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
      dimensions: ['scope', 'category', 'facility'],
      byScope: [],
      byCategory: [],
      byFacility: [
        {
          facilityId: 'fac1',
          facilityName: 'Warehouse A',
          location: 'London, UK',
          totalCo2e: 1500,
          recordCount: 45,
        },
      ],
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    );

    const { result } = renderHook(() => useDrillDown('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.byFacility?.[0].location).toBe('London, UK');
      expect(result.current.data?.byFacility?.[0].recordCount).toBe(45);
    });
  });
});
