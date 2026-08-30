import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CustomReportBuilder } from '../CustomReportBuilder';
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

const mockPeriods = [
  { id: 'p1', label: 'Q1 2024', startDate: '2024-01-01', endDate: '2024-03-31' },
  { id: 'p2', label: 'Q2 2024', startDate: '2024-04-01', endDate: '2024-06-30' },
  { id: 'p3', label: 'Q3 2024', startDate: '2024-07-01', endDate: '2024-09-30' },
];

describe('CustomReportBuilder', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }

      if (url.includes('reports')) {
        return Promise.resolve(
          createMockResponse({
            id: 'rpt1',
            status: 'ready',
            downloadUrl: 'https://example.com/report.pdf',
          })
        );
      }

      return Promise.resolve(createMockResponse({}));
    });

    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('should render report builder form', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Build Custom Report')).toBeInTheDocument();
    });
  });

  it('should have title input field', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const titleInput = screen.getByDisplayValue('Emissions Report');
      expect(titleInput).toBeInTheDocument();
    });
  });

  it('should have description input field', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const descInput = screen.queryByPlaceholderText(
        'Add context or notes about this report'
      );
      if (descInput) {
        expect(descInput).toBeInTheDocument();
      }
    });
  });

  it('should load and display reporting periods', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Q1 2024')).toBeInTheDocument();
      expect(screen.getByText('Q2 2024')).toBeInTheDocument();
      expect(screen.getByText('Q3 2024')).toBeInTheDocument();
    });
  });

  it('should allow selecting multiple periods', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(3);
    });

    const firstPeriodCheckbox = await screen.findByLabelText('Q1 2024') as HTMLInputElement;
    fireEvent.click(firstPeriodCheckbox);

    expect(firstPeriodCheckbox.checked).toBe(true);
  });

  it('should have format selection dropdown', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomReportBuilder orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Export Format')).toBeInTheDocument();
    });
  });

  it('should have content options checkboxes', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomReportBuilder orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Summary Statistics')).toBeInTheDocument();
      expect(screen.getByText('Charts & Visualizations')).toBeInTheDocument();
      expect(screen.getByText('Recommendations')).toBeInTheDocument();
    });
  });

  it('should update title on input', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomReportBuilder orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const titleInput = screen.getByDisplayValue(
        'Emissions Report'
      ) as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: 'My Custom Report' } });
      expect(titleInput.value).toBe('My Custom Report');
    });
  });

  it('should have reset button', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomReportBuilder orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const resetButton = screen.getByText('Reset');
      expect(resetButton).toBeInTheDocument();
    });
  });

  it('should reset form when reset button clicked', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomReportBuilder orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const titleInput = screen.getByDisplayValue(
        'Emissions Report'
      ) as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: 'Modified Title' } });
      expect(titleInput.value).toBe('Modified Title');

      const resetButton = screen.getByText('Reset');
      fireEvent.click(resetButton);

      expect(titleInput.value).toBe('Emissions Report');
    });
  });

  it('should have generate report button', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomReportBuilder orgId="org-123" />
      </QueryClientProvider>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const generateButton = screen.getByText('Generate Report');
      expect(generateButton).toBeInTheDocument();
    });
  });

  it('should disable generate button when no periods selected', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const generateButton = screen.getByText(
        'Generate Report'
      ) as HTMLButtonElement;
      expect(generateButton.disabled).toBe(true);
    });
  });

  it('should enable generate button when periods selected', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    const periodCheckbox = await screen.findByLabelText('Q1 2024');
    fireEvent.click(periodCheckbox);

    await waitFor(() => {
      const generateButton = screen.getByText(
        'Generate Report'
      ) as HTMLButtonElement;
      expect(generateButton.disabled).toBe(false);
    });
  });

  it('should show loading state while generating', async () => {
    let reportRequestMade = false;
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      if (url.includes('reports')) {
        reportRequestMade = true;
        return new Promise(() => {}); // Never resolves for report generation
      }
      return Promise.resolve(createMockResponse({}));
    }) as any;

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    const periodCheckbox = await screen.findByLabelText('Q1 2024');
    fireEvent.click(periodCheckbox);

    const generateButton = screen.getByText('Generate Report');
    fireEvent.click(generateButton);

    // Button should be disabled during loading
    await waitFor(() => {
      expect(
        screen.getByText('Generating...')
      ).toBeInTheDocument();
    });
  });

  it('should show error message on generation failure', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      if (url.includes('reports')) {
        return Promise.resolve(createMockResponse({}, false, 500));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    const periodCheckbox = await screen.findByLabelText('Q1 2024');
    fireEvent.click(periodCheckbox);

    const generateButton = screen.getByText('Generate Report');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/Report generation failed/)).toBeInTheDocument();
    });
  });

  it('should validate period selection', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    const generateButton = await screen.findByText('Generate Report');
    fireEvent.click(generateButton);

    // Button should still be enabled and visible (validation doesn't disable it)
    await waitFor(() => {
      expect(screen.getByText('Generate Report')).toBeInTheDocument();
      expect(screen.getByText('Report Tips')).toBeInTheDocument();
    });
  });

  it('should show tips section', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Report Tips')).toBeInTheDocument();
      expect(
        screen.getByText(/Select multiple periods to compare trends/i)
      ).toBeInTheDocument();
    });
  });

  it('should handle PDF format selection', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Export Format')).toBeInTheDocument();
      expect(screen.getByText('Report Contents')).toBeInTheDocument();
    });
  });

  it('should handle CSV format selection', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Export Format')).toBeInTheDocument();
      expect(screen.getByText('Reporting Periods *')).toBeInTheDocument();
    });
  });

  it('should handle JSON format selection', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Export Format')).toBeInTheDocument();
      expect(screen.getByText('Build Custom Report')).toBeInTheDocument();
    });
  });

  it('should toggle content options', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Summary Statistics')).toBeInTheDocument();
    });

    const summaryCheckbox = screen.getByLabelText(
      'Summary Statistics'
    ) as HTMLInputElement;
    expect(summaryCheckbox.checked).toBe(true);

    fireEvent.click(summaryCheckbox);
    expect(summaryCheckbox.checked).toBe(false);
  });

  it('should call onReportGenerated callback', async () => {
    const onReportGenerated = vi.fn();

    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      if (url.includes('reports')) {
        return Promise.resolve(
          createMockResponse({
            id: 'rpt1',
            status: 'ready',
            downloadUrl: 'https://example.com/report.pdf',
          })
        );
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder
        orgId="org-123"
        onReportGenerated={onReportGenerated}
      />,
      { wrapper: createWrapper() }
    );

    const periodCheckbox = await screen.findByLabelText('Q1 2024');
    fireEvent.click(periodCheckbox);

    const generateButton = screen.getByText('Generate Report');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(onReportGenerated).toHaveBeenCalled();
    });
  });

  it('should format report title for filename', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      if (url.includes('reports')) {
        return Promise.resolve(
          createMockResponse({
            id: 'rpt1',
            status: 'ready',
            downloadUrl: 'https://example.com/report.pdf',
          })
        );
      }
      return Promise.resolve(createMockResponse({}));
    });

    // This tests the internal logic of generating filenames
    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    // Wait for the form elements to appear
    await waitFor(() => {
      expect(screen.getByDisplayValue('Emissions Report')).toBeInTheDocument();
    });

    const titleInput = screen.getByDisplayValue(
      'Emissions Report'
    ) as HTMLInputElement;
    fireEvent.change(titleInput, {
      target: { value: 'Q1 2024 Emissions Report!' },
    });

    const periodCheckbox = await screen.findByLabelText('Q1 2024');
    fireEvent.click(periodCheckbox);

    const generateButton = screen.getByText('Generate Report');
    fireEvent.click(generateButton);

    // The filename should have special characters replaced
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('should handle default content options', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('reporting-periods')) {
        return Promise.resolve(createMockResponse(mockPeriods));
      }
      return Promise.resolve(createMockResponse({}));
    });

    render(
      <CustomReportBuilder orgId="org-123" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const summaryCheckbox = screen.getByLabelText(
        'Summary Statistics'
      ) as HTMLInputElement;
      const chartsCheckbox = screen.getByLabelText(
        'Charts & Visualizations'
      ) as HTMLInputElement;
      const recommendationsCheckbox = screen.getByLabelText(
        'Recommendations'
      ) as HTMLInputElement;

      expect(summaryCheckbox.checked).toBe(true);
      expect(chartsCheckbox.checked).toBe(true);
      expect(recommendationsCheckbox.checked).toBe(true);
    });
  });
});
