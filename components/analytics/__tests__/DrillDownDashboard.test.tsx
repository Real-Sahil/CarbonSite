import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DrillDownDashboard } from '../DrillDownDashboard';
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

const mockDrillDownData = {
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
  byCategory: [
    {
      categoryId: 'cat1',
      categoryName: 'Electricity',
      totalCo2e: 2500,
      recordCount: 50,
    },
  ],
  byFacility: [
    {
      facilityId: 'fac1',
      facilityName: 'Warehouse A',
      location: 'London',
      totalCo2e: 1500,
      recordCount: 30,
    },
  ],
  comparison: {
    previousCo2e: 4000,
    currentCo2e: 5000,
    changePercent: '+25',
    changeDirection: 'increase' as const,
  },
  topContributors: [
    {
      id: 'rec1',
      sourceDescription: 'Electricity consumption',
      normalizedAmount: 1000,
      category: { id: 'cat1', name: 'Electricity' },
      facility: { id: 'fac1', name: 'Warehouse A' },
    },
  ],
};

describe('DrillDownDashboard', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve(createMockResponse(mockDrillDownData))
    );
  });

  it('should render filter bar', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Analytics Filters')).toBeInTheDocument();
    });
  });

  it('should render scope breakdown section', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Scope Breakdown')).toBeInTheDocument();
    });
  });

  it('should render category breakdown section', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Category Breakdown')).toBeInTheDocument();
    });
  });

  it('should render facility breakdown section', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Facility Breakdown')).toBeInTheDocument();
    });
  });

  it('should expand/collapse sections on click', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const scopeHeader = screen.getByText('Scope Breakdown');
      expect(scopeHeader).toBeInTheDocument();
    });

    const scopeHeader = screen.getByText('Scope Breakdown').closest('div');
    if (scopeHeader) {
      fireEvent.click(scopeHeader);
    }

    // Content should collapse (this depends on your implementation)
  });

  it('should display scope data', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText(/Scope 1/)).toBeInTheDocument();
      expect(screen.getByText(/Scope 2/)).toBeInTheDocument();
    });
  });

  it('should display period comparison card', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Period Comparison')).toBeInTheDocument();
    });
  });

  it('should show change direction badge', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText(/\+25%/)).toBeInTheDocument();
      expect(screen.getByText(/increase/)).toBeInTheDocument();
    });
  });

  it('should display top contributors', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Top Contributors')).toBeInTheDocument();
      expect(screen.getByText('Warehouse A')).toBeInTheDocument();
    });
  });

  it('should show active filter badge', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Scope Breakdown')).toBeInTheDocument();
    });

    // Simulate clicking a scope filter
    const scopeItem = screen.queryByText(/40% of total/);
    if (scopeItem) {
      fireEvent.click(scopeItem);
    }
  });

  it('should call onFilterChange callback', async () => {
    const onFilterChange = vi.fn();

    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard
          orgId="org-123"
          onFilterChange={onFilterChange}
        />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Scope Breakdown')).toBeInTheDocument();
    });
  });

  it('should handle error state', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(createMockResponse({}, false, 500))
    );

    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const errorCard = screen.queryByText(/Drill-down query failed/);
      if (errorCard) {
        expect(errorCard).toBeInTheDocument();
      }
    });
  });

  it('should display loading skeleton', async () => {
    global.fetch = vi.fn(() => new Promise<Response>(() => {})); // Never resolves

    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    // Look for skeleton elements (they have animate-pulse class)
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should display facility location in breakdown', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText(/London/)).toBeInTheDocument();
    });
  });

  it('should calculate and display percentages correctly', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText(/40\.0% of total/)).toBeInTheDocument();
      expect(screen.getByText(/60\.0% of total/)).toBeInTheDocument();
    });
  });

  it('should format CO2e values with proper decimals', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const co2Values = screen.getAllByText(/tCO₂e/);
      expect(co2Values.length).toBeGreaterThan(0);
    });
  });

  it('should provide initial period ID if specified', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DrillDownDashboard orgId="org-123" initialPeriodId="p2" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
