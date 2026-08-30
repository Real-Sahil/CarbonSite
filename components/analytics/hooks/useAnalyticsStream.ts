import { useEffect, useState, useCallback, useRef } from 'react';

export interface AnalyticsEvent {
  type: 'calculation_progress' | 'analytics_updated' | 'anomaly_detected' | 'error' | 'heartbeat';
  orgId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface UseAnalyticsStreamOptions {
  orgId: string;
  onEvent?: (event: AnalyticsEvent) => void;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

export function useAnalyticsStream({
  orgId,
  onEvent,
  autoReconnect = true,
  maxReconnectAttempts = 5,
}: UseAnalyticsStreamOptions) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCleaningUpRef = useRef(false);

  const connect = useCallback(() => {
    if (isCleaningUpRef.current) return;

    try {
      const eventSource = new EventSource(
        `/api/orgs/${orgId}/analytics/stream`
      );

      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
        setReconnectAttempt(0);
      };

      eventSource.onmessage = (event) => {
        try {
          const analyticsEvent: AnalyticsEvent = JSON.parse(event.data);
          onEvent?.(analyticsEvent);
        } catch (err) {
          console.error('Error parsing analytics SSE data:', err);
          setError('Failed to parse analytics update');
        }
      };

      eventSource.onerror = () => {
        setConnected(false);

        if (eventSource.readyState === EventSource.CLOSED) {
          setError('Connection closed by server');

          if (autoReconnect && reconnectAttempt < maxReconnectAttempts) {
            const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
            setReconnectAttempt(prev => prev + 1);

            reconnectTimerRef.current = setTimeout(() => {
              if (!isCleaningUpRef.current) {
                connect();
              }
            }, backoffMs);
          }
        }
      };
    } catch (err) {
      setConnected(false);
      setError(`Failed to connect to analytics stream: ${err instanceof Error ? err.message : 'Unknown error'}`);

      if (autoReconnect && reconnectAttempt < maxReconnectAttempts) {
        const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
        setReconnectAttempt(prev => prev + 1);

        reconnectTimerRef.current = setTimeout(() => {
          if (!isCleaningUpRef.current) {
            connect();
          }
        }, backoffMs);
      }
    }
  }, [orgId, onEvent, autoReconnect, reconnectAttempt, maxReconnectAttempts]);

  useEffect(() => {
    isCleaningUpRef.current = false;
    connect();

    return () => {
      isCleaningUpRef.current = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect]);

  return {
    connected,
    error,
    reconnectAttempt,
    reconnect: () => {
      setReconnectAttempt(0);
      connect();
    },
  };
}
