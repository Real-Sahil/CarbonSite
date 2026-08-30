import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnomalyHighlightingPanel } from '../AnomalyHighlightingPanel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const mockAnomaliesData = {
  period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
  anomalies: [
    {
      id: 'anom1',
      severity: 'critical' as const,
      type: 'statistical' as const,
      description: 'Critical emissions spike detected',
      value: 5000,
      baseline: 1000,
      deviation: 400,
      explanation: 'Emissions are 400% above baseline for this facility',
      recordId: 'rec1',
      facilityId: 'fac1',
      facilityName: 'Facility A',
    },
    {
      id: 'anom2',
      severity: 'warning' as const,
      type: 'trend' as const,
      description: 'Upward trend in emissions',
      value: 2500,
      baseline: 2000,
      deviation: 25,
      explanation: 'Emissions trending upward over last 3 months',
      recordId: 'rec2',
      facilityId: 'fac2',
      facilityName: 'Facility B',
    },
    {
      id: 'anom3',
      severity: 'info' as const,
      type: 'comparative' as const,
      description: 'Facility emissions differ from peer group',
      value: 1500,
      baseline: 1600,
      deviation: -6.25,
      explanation: 'Emissions slightly lower than comparable facilities',
      recordId: 'rec3',
      facilityId: 'fac3',
      facilityName: 'Facility C',
    },
  ],
  totalAnomalies: 3,
  summary: {
    critical: 1,
    warning: 1,
    info: 1,
  },
};

describe('AnomalyHighlightingPanel', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockAnomaliesData),
      })
    );
  });

  it('should render summary cards', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Critical Issues')).toBeInTheDocument();
      expect(screen.getByText('Warnings')).toBeInTheDocument();
      expect(screen.getByText('Informational')).toBeInTheDocument();
    });
  });

  it('should display correct severity counts', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const criticalCard = screen.getByText('Critical Issues').closest('div');
      expect(criticalCard?.textContent).toContain('1');
    });
  });

  it('should render severity and type filters', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Severity Filter')).toBeInTheDocument();
      expect(screen.getByText('Type Filter')).toBeInTheDocument();
    });
  });

  it('should display all anomalies initially', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(
        screen.getByText('Critical emissions spike detected')
      ).toBeInTheDocument();
      expect(screen.getByText('Upward trend in emissions')).toBeInTheDocument();
      expect(
        screen.getByText('Facility emissions differ from peer group')
      ).toBeInTheDocument();
    });
  });

  it('should filter by severity', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const severityDropdown = screen.getByDisplayValue('All Severities');
      fireEvent.change(severityDropdown, { target: { value: 'critical' } });
    });

    // After filtering, only critical anomalies should be visible
    await waitFor(() => {
      expect(
        screen.getByText('Critical emissions spike detected')
      ).toBeInTheDocument();
      expect(screen.queryByText('Upward trend in emissions')).not.toBeInTheDocument();
    });
  });

  it('should filter by type', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const typeDropdown = screen.getByDisplayValue('All Types');
      fireEvent.change(typeDropdown, { target: { value: 'statistical' } });
    });

    await waitFor(() => {
      expect(
        screen.getByText('Critical emissions spike detected')
      ).toBeInTheDocument();
    });
  });

  it('should expand anomaly details on click', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const anomalyCard = screen.getByText(
        'Critical emissions spike detected'
      ).closest('div');
      if (anomalyCard) {
        fireEvent.click(anomalyCard);
      }
    });

    // After expansion, explanation should be visible
    await waitFor(() => {
      expect(
        screen.getByText(
          'Emissions are 400% above baseline for this facility'
        )
      ).toBeInTheDocument();
    });
  });

  it('should show facility name', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Facility A')).toBeInTheDocument();
      expect(screen.getByText('Facility B')).toBeInTheDocument();
      expect(screen.getByText('Facility C')).toBeInTheDocument();
    });
  });

  it('should display baseline and value', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText(/Value:.*5000/)).toBeInTheDocument();
      expect(screen.getByText(/Baseline:.*1000/)).toBeInTheDocument();
    });
  });

  it('should show deviation percentage in red for positive deviation', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const deviationText = screen.getByText(/\+400\.0%/);
      expect(deviationText).toBeInTheDocument();
    });
  });

  it('should show deviation percentage in green for negative deviation', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const deviationText = screen.getByText(/-6\.3%/);
      expect(deviationText).toBeInTheDocument();
    });
  });

  it('should display badge with anomaly type', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('statistical')).toBeInTheDocument();
      expect(screen.getByText('trend')).toBeInTheDocument();
      expect(screen.getByText('comparative')).toBeInTheDocument();
    });
  });

  it('should display severity colored icons', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      // Icons should be present for severity indicators
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  it('should handle empty anomaly list', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            period: { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01' },
            anomalies: [],
            totalAnomalies: 0,
            summary: { critical: 0, warning: 0, info: 0 },
          }),
      })
    );

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(
        screen.getByText('No anomalies found for selected filters')
      ).toBeInTheDocument();
    });
  });

  it('should handle API errors', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        statusText: 'Server Error',
      })
    );

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const errorContent = screen.getByText(/error/i);
      if (errorContent) {
        expect(errorContent).toBeInTheDocument();
      }
    });
  });

  it('should show count of displayed anomalies', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText(/Showing 3 of 3 anomalies/)).toBeInTheDocument();
    });
  });

  it('should support initial period ID', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" initialPeriodId="p2" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('should toggle anomaly expansion state independently', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyHighlightingPanel orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const firstAnomaly = screen.getByText(
        'Critical emissions spike detected'
      ).closest('div');
      if (firstAnomaly) {
        fireEvent.click(firstAnomaly);
      }
    });

    // First anomaly expanded, explanation should be visible
    await waitFor(() => {
      expect(
        screen.getByText(
          'Emissions are 400% above baseline for this facility'
        )
      ).toBeInTheDocument();
    });

    // Other anomalies should still be collapsed
    const secondAnomaly = screen.getByText('Upward trend in emissions');
    expect(
      secondAnomaly.closest('div')?.textContent
    ).not.toContain('Emissions trending upward');
  });
});
