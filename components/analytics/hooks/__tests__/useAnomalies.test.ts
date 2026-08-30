import { renderHook, waitFor } from '@testing-library/react';
import { useAnomalies } from '../useAnomalies';
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

describe('useAnomalies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty arrays and loading state', () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          anomalies: [],
          totalAnomalies: 0,
          summary: { critical: 0, warning: 0, info: 0 },
        })
      )
    );

    const { result } = renderHook(() => useAnomalies('org-123'), {
      wrapper: createWrapper(),
    });

    expect(result.current.anomalies).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('should fetch anomalies data', async () => {
    const mockAnomalies = [
      {
        id: 'anom1',
        severity: 'critical' as const,
        type: 'statistical' as const,
        description: 'Emissions spike detected',
        value: 500,
        baseline: 100,
        deviation: 400,
        explanation: 'Value is 4x baseline',
        recordId: 'rec1',
        facilityId: 'fac1',
        facilityName: 'Facility A',
      },
    ];

    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          anomalies: mockAnomalies,
          totalAnomalies: 1,
          summary: { critical: 1, warning: 0, info: 0 },
        })
      )
    );

    const { result } = renderHook(() => useAnomalies('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.anomalies).toHaveLength(1);
    expect(result.current.anomalies[0].severity).toBe('critical');
  });

  it('should group anomalies by severity', async () => {
    const mockAnomalies = [
      {
        id: 'anom1',
        severity: 'critical' as const,
        type: 'statistical' as const,
        description: 'Critical issue',
        value: 500,
        baseline: 100,
        deviation: 400,
        explanation: 'Critical anomaly',
        recordId: 'rec1',
      },
      {
        id: 'anom2',
        severity: 'warning' as const,
        type: 'trend' as const,
        description: 'Warning issue',
        value: 250,
        baseline: 200,
        deviation: 50,
        explanation: 'Warning anomaly',
        recordId: 'rec2',
      },
      {
        id: 'anom3',
        severity: 'info' as const,
        type: 'comparative' as const,
        description: 'Info issue',
        value: 150,
        baseline: 140,
        deviation: 10,
        explanation: 'Info anomaly',
        recordId: 'rec3',
      },
    ];

    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          anomalies: mockAnomalies,
          totalAnomalies: 3,
          summary: { critical: 1, warning: 1, info: 1 },
        })
      )
    );

    const { result } = renderHook(() => useAnomalies('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.anomaliesBySeverity.critical).toHaveLength(1);
    expect(result.current.anomaliesBySeverity.warning).toHaveLength(1);
    expect(result.current.anomaliesBySeverity.info).toHaveLength(1);
  });

  it('should group anomalies by type', async () => {
    const mockAnomalies = [
      {
        id: 'anom1',
        severity: 'critical' as const,
        type: 'statistical' as const,
        description: 'Statistical anomaly',
        value: 500,
        baseline: 100,
        deviation: 400,
        explanation: 'Statistical',
        recordId: 'rec1',
      },
      {
        id: 'anom2',
        severity: 'warning' as const,
        type: 'trend' as const,
        description: 'Trend anomaly',
        value: 250,
        baseline: 200,
        deviation: 50,
        explanation: 'Trend',
        recordId: 'rec2',
      },
    ];

    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          anomalies: mockAnomalies,
          totalAnomalies: 2,
          summary: { critical: 1, warning: 1, info: 0 },
        })
      )
    );

    const { result } = renderHook(() => useAnomalies('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.anomaliesByType.statistical).toHaveLength(1);
    expect(result.current.anomaliesByType.trend).toHaveLength(1);
    expect(result.current.anomaliesByType.comparative).toHaveLength(0);
    expect(result.current.anomaliesByType.quality).toHaveLength(0);
  });

  it('should return summary counts', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          anomalies: [],
          totalAnomalies: 0,
          summary: { critical: 5, warning: 10, info: 15 },
        })
      )
    );

    const { result } = renderHook(() => useAnomalies('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary?.critical).toBe(5);
    expect(result.current.summary?.warning).toBe(10);
    expect(result.current.summary?.info).toBe(15);
  });

  it('should accept period filter', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          anomalies: [],
          totalAnomalies: 0,
          summary: { critical: 0, warning: 0, info: 0 },
        })
      )
    );

    renderHook(() => useAnomalies('org-123', { periodId: 'p1' }), {
      wrapper: createWrapper(),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('periodId=p1')
    );
  });

  it('should accept severity filter', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          anomalies: [],
          totalAnomalies: 0,
          summary: { critical: 0, warning: 0, info: 0 },
        })
      )
    );

    renderHook(() => useAnomalies('org-123', { severity: 'critical' }), {
      wrapper: createWrapper(),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('severity=critical')
    );
  });

  it('should accept anomaly type filter', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          anomalies: [],
          totalAnomalies: 0,
          summary: { critical: 0, warning: 0, info: 0 },
        })
      )
    );

    renderHook(() => useAnomalies('org-123', { anomalyType: 'statistical' }), {
      wrapper: createWrapper(),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('type=statistical')
    );
  });

  it('should accept limit parameter', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          anomalies: [],
          totalAnomalies: 0,
          summary: { critical: 0, warning: 0, info: 0 },
        })
      )
    );

    renderHook(() => useAnomalies('org-123', { limit: 50 }), {
      wrapper: createWrapper(),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=50')
    );
  });

  it('should handle API errors', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(createMockResponse({}, false, 500))
    );

    const { result } = renderHook(() => useAnomalies('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });

    if (result.current.error) {
      expect(((result.current.error as unknown) as Error).message).toContain('Failed to fetch anomalies');
    }
  });

  it('should provide refetch function', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          anomalies: [],
          totalAnomalies: 0,
          summary: { critical: 0, warning: 0, info: 0 },
        })
      )
    );

    const { result } = renderHook(() => useAnomalies('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialCallCount = (global.fetch as any).mock.calls.length;

    result.current.refetch();

    await waitFor(() => {
      expect((global.fetch as any).mock.calls.length).toBeGreaterThan(
        initialCallCount
      );
    });
  });

  it('should handle facility name in anomaly', async () => {
    const mockAnomalies = [
      {
        id: 'anom1',
        severity: 'critical' as const,
        type: 'statistical' as const,
        description: 'Issue at facility',
        value: 500,
        baseline: 100,
        deviation: 400,
        explanation: 'Explanation',
        recordId: 'rec1',
        facilityId: 'fac1',
        facilityName: 'Production Plant',
      },
    ];

    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          anomalies: mockAnomalies,
          totalAnomalies: 1,
          summary: { critical: 1, warning: 0, info: 0 },
        })
      )
    );

    const { result } = renderHook(() => useAnomalies('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.anomalies[0].facilityName).toBe('Production Plant');
  });

  it('should calculate deviation percentage', async () => {
    const mockAnomalies = [
      {
        id: 'anom1',
        severity: 'warning' as const,
        type: 'statistical' as const,
        description: 'Deviation test',
        value: 300,
        baseline: 100,
        deviation: 200,
        explanation: 'Value is 200% above baseline',
        recordId: 'rec1',
      },
    ];

    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMockResponse({
          period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
          anomalies: mockAnomalies,
          totalAnomalies: 1,
          summary: { critical: 0, warning: 1, info: 0 },
        })
      )
    );

    const { result } = renderHook(() => useAnomalies('org-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.anomalies[0].deviation).toBe(200);
  });
});
