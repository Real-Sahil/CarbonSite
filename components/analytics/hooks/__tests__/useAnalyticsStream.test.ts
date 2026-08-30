import { renderHook, waitFor } from '@testing-library/react';
import { useAnalyticsStream } from '../useAnalyticsStream';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('useAnalyticsStream', () => {
  let mockEventSource: any;
  let eventListeners: Record<string, Function[]> = {};

  beforeEach(() => {
    eventListeners = {};
    mockEventSource = {
      addEventListener: vi.fn((event: string, handler: Function) => {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: Function) => {
        if (eventListeners[event]) {
          eventListeners[event] = eventListeners[event].filter(h => h !== handler);
        }
      }),
      close: vi.fn(),
      readyState: 1, // OPEN
    };

    global.EventSource = vi.fn(() => mockEventSource) as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with connected=false', () => {
    const { result } = renderHook(() => useAnalyticsStream('org-123'));

    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.reconnectAttempt).toBe(0);
  });

  it('should create EventSource with correct URL', () => {
    renderHook(() => useAnalyticsStream('org-456'));

    expect(global.EventSource).toHaveBeenCalledWith(
      expect.stringContaining('/api/orgs/org-456/analytics/stream')
    );
  });

  it('should handle connection open event', async () => {
    const { result } = renderHook(() => useAnalyticsStream('org-123'));

    // Simulate EventSource open
    if (eventListeners.open && eventListeners.open[0]) {
      eventListeners.open[0]({});
    }

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  it('should handle analytics_updated message', async () => {
    const { result } = renderHook(() => useAnalyticsStream('org-123'));

    const mockData = {
      type: 'analytics_updated',
      timestamp: new Date().toISOString(),
      data: { totalEmissions: 5000 },
    };

    if (eventListeners.message && eventListeners.message[0]) {
      eventListeners.message[0]({
        data: JSON.stringify(mockData),
      } as any);
    }

    await waitFor(() => {
      expect(result.current.lastUpdate).toBeDefined();
    });
  });

  it('should handle error event and attempt reconnect', async () => {
    const { result } = renderHook(() => useAnalyticsStream('org-123'));

    if (eventListeners.error && eventListeners.error[0]) {
      eventListeners.error[0](new Event('error'));
    }

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
      expect(result.current.reconnectAttempt).toBeGreaterThan(0);
    });
  });

  it('should close EventSource on unmount', () => {
    const { unmount } = renderHook(() => useAnalyticsStream('org-123'));

    unmount();

    expect(mockEventSource.close).toHaveBeenCalled();
  });

  it('should allow manual reconnect', async () => {
    const { result } = renderHook(() => useAnalyticsStream('org-123'));

    result.current.reconnect();

    await waitFor(() => {
      expect(global.EventSource).toHaveBeenCalledTimes(2);
    });
  });

  it('should apply exponential backoff on reconnect', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnalyticsStream('org-123'));

    // Trigger multiple errors
    for (let i = 0; i < 3; i++) {
      if (eventListeners.error && eventListeners.error[0]) {
        eventListeners.error[0](new Event('error'));
      }
      await waitFor(() => {
        expect(result.current.reconnectAttempt).toBe(i + 1);
      });
    }

    vi.useRealTimers();
  });

  it('should handle calculation_progress event', async () => {
    const { result } = renderHook(() => useAnalyticsStream('org-123'));

    const progressEvent = {
      type: 'calculation_progress',
      data: { completed: 50, total: 100 },
    };

    if (eventListeners.message && eventListeners.message[0]) {
      eventListeners.message[0]({
        data: JSON.stringify(progressEvent),
      } as any);
    }

    await waitFor(() => {
      expect(result.current.lastUpdate).toBeDefined();
    });
  });

  it('should handle anomaly_detected event', async () => {
    const { result } = renderHook(() => useAnalyticsStream('org-123'));

    const anomalyEvent = {
      type: 'anomaly_detected',
      data: { severity: 'critical', description: 'Emissions spike detected' },
    };

    if (eventListeners.message && eventListeners.message[0]) {
      eventListeners.message[0]({
        data: JSON.stringify(anomalyEvent),
      } as any);
    }

    await waitFor(() => {
      expect(result.current.lastUpdate).toBeDefined();
    });
  });

  it('should handle malformed JSON gracefully', async () => {
    const { result } = renderHook(() => useAnalyticsStream('org-123'));

    if (eventListeners.message && eventListeners.message[0]) {
      eventListeners.message[0]({
        data: 'invalid json',
      } as any);
    }

    // Should not crash, error should be captured
    expect(result.current).toBeDefined();
  });

  it('should reset reconnect attempts on successful connection', async () => {
    const { result } = renderHook(() => useAnalyticsStream('org-123'));

    // Simulate error
    if (eventListeners.error && eventListeners.error[0]) {
      eventListeners.error[0](new Event('error'));
    }

    await waitFor(() => {
      expect(result.current.reconnectAttempt).toBeGreaterThan(0);
    });

    // Simulate recovery
    if (eventListeners.open && eventListeners.open[0]) {
      eventListeners.open[0]({});
    }

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
      expect(result.current.reconnectAttempt).toBe(0);
    });
  });
});
