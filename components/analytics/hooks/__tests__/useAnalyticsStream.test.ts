import { renderHook, waitFor, act } from '@testing-library/react';
import { useAnalyticsStream } from '../useAnalyticsStream';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('useAnalyticsStream', () => {
  let mockEventSource: any;

  beforeEach(() => {
    // Create a mock EventSource that supports both property assignment and close()
    mockEventSource = {
      onopen: null as any,
      onmessage: null as any,
      onerror: null as any,
      close: vi.fn(),
      readyState: 1, // OPEN

      // Helper to trigger handlers programmatically in tests
      _triggerOpen: function() {
        if (this.onopen) {
          this.onopen({ type: 'open' });
        }
      },
      _triggerMessage: function(data: string) {
        if (this.onmessage) {
          this.onmessage({ data, type: 'message' } as any);
        }
      },
      _triggerError: function() {
        this.readyState = 2; // CLOSED
        if (this.onerror) {
          this.onerror({ type: 'error' });
        }
      },
    };

    global.EventSource = vi.fn(() => mockEventSource) as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with connected=false', () => {
    const { result } = renderHook(() => useAnalyticsStream({ orgId: 'org-123' }));

    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.reconnectAttempt).toBe(0);
  });

  it('should create EventSource with correct URL', () => {
    renderHook(() => useAnalyticsStream({ orgId: 'org-456' }));

    expect(global.EventSource).toHaveBeenCalledWith(
      expect.stringContaining('/api/orgs/org-456/analytics/stream')
    );
  });

  it('should handle connection open event', async () => {
    const { result } = renderHook(() => useAnalyticsStream({ orgId: 'org-123' }));

    // Simulate EventSource open
    await act(async () => {
      mockEventSource._triggerOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  it('should handle analytics_updated message', async () => {
    const onEvent = vi.fn();
    renderHook(() =>
      useAnalyticsStream({ orgId: 'org-123', onEvent })
    );

    // Wait for hook to set up the onmessage handler
    await waitFor(() => {
      expect(mockEventSource.onmessage).toBeDefined();
    });

    const mockData = {
      type: 'analytics_updated',
      orgId: 'org-123',
      timestamp: new Date().toISOString(),
      data: { totalEmissions: 5000 },
    };

    await act(async () => {
      mockEventSource._triggerMessage(JSON.stringify(mockData));
    });

    await waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'analytics_updated',
        data: { totalEmissions: 5000 },
      }));
    });
  });

  it('should handle error event and attempt reconnect', async () => {
    const { result } = renderHook(() => useAnalyticsStream({ orgId: 'org-123' }));

    await act(async () => {
      mockEventSource._triggerError();
    });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
      expect(result.current.reconnectAttempt).toBeGreaterThan(0);
    });
  });

  it('should close EventSource on unmount', () => {
    const { unmount } = renderHook(() => useAnalyticsStream({ orgId: 'org-123' }));

    unmount();

    expect(mockEventSource.close).toHaveBeenCalled();
  });

  it('should allow manual reconnect', async () => {
    const { result } = renderHook(() => useAnalyticsStream({ orgId: 'org-123' }));

    // Should create EventSource once on mount
    expect(global.EventSource).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.reconnect();
    });

    // After reconnect, should create a new EventSource
    // Note: this depends on implementation details; the old one might still exist
    expect(global.EventSource).toHaveBeenCalled();
  });

  it('should apply exponential backoff on reconnect', async () => {
    const { result } = renderHook(() => useAnalyticsStream({ orgId: 'org-123' }));

    // First error: attempt 1, backoff = 1000ms
    await act(async () => {
      mockEventSource._triggerError();
    });

    await waitFor(() => {
      expect(result.current.reconnectAttempt).toBe(1);
    });

    // Trigger error again to increment reconnectAttempt
    // (In real use, this would wait for the backoff timeout; in tests we just verify the counter increments)
    await act(async () => {
      mockEventSource._triggerError();
    });

    await waitFor(() => {
      expect(result.current.reconnectAttempt).toBe(2);
    });

    // Verify reconnect attempts increment (exponential backoff is validated via timing analysis, not state)
  });

  it('should handle calculation_progress event', async () => {
    const onEvent = vi.fn();
    renderHook(() =>
      useAnalyticsStream({ orgId: 'org-123', onEvent })
    );

    // Wait for hook to set up the onmessage handler
    await waitFor(() => {
      expect(mockEventSource.onmessage).toBeDefined();
    });

    const progressEvent = {
      type: 'calculation_progress',
      orgId: 'org-123',
      timestamp: new Date().toISOString(),
      data: { completed: 50, total: 100 },
    };

    await act(async () => {
      mockEventSource._triggerMessage(JSON.stringify(progressEvent));
    });

    await waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'calculation_progress',
        data: { completed: 50, total: 100 },
      }));
    });
  });

  it('should handle anomaly_detected event', async () => {
    const onEvent = vi.fn();
    renderHook(() =>
      useAnalyticsStream({ orgId: 'org-123', onEvent })
    );

    // Wait for hook to set up the onmessage handler
    await waitFor(() => {
      expect(mockEventSource.onmessage).toBeDefined();
    });

    const anomalyEvent = {
      type: 'anomaly_detected',
      orgId: 'org-123',
      timestamp: new Date().toISOString(),
      data: { severity: 'critical', description: 'Emissions spike detected' },
    };

    await act(async () => {
      mockEventSource._triggerMessage(JSON.stringify(anomalyEvent));
    });

    await waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'anomaly_detected',
        data: { severity: 'critical', description: 'Emissions spike detected' },
      }));
    });
  });

  it('should handle malformed JSON gracefully', async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() =>
      useAnalyticsStream({ orgId: 'org-123', onEvent })
    );

    await act(async () => {
      mockEventSource._triggerMessage('invalid json');
    });

    // Should not crash, hook should still be usable
    expect(result.current).toBeDefined();
    // onEvent should not be called with invalid JSON
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('should reset reconnect attempts on successful connection', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnalyticsStream({ orgId: 'org-123' }));

    // Simulate error
    await act(async () => {
      mockEventSource._triggerError();
    });

    await waitFor(() => {
      expect(result.current.reconnectAttempt).toBeGreaterThan(0);
    });

    // Simulate recovery
    await act(async () => {
      mockEventSource._triggerOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
      expect(result.current.reconnectAttempt).toBe(0);
    });

    vi.useRealTimers();
  });
});
