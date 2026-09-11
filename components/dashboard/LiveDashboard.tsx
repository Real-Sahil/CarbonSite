'use client';

import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface DashboardData {
  aggregates: {
    totalCo2e: number;
    scope1: number;
    scope2: number;
    scope3: number;
    byCategory: Record<string, number>;
  };
  timestamp: string;
  calculationRunId: string;
}

interface LiveDashboardProps {
  orgId: string;
  onUpdate?: (data: DashboardData) => void;
  fallbackComponent?: React.ReactNode;
}

/**
 * Real-time dashboard component that streams updates via Server-Sent Events.
 * Pauses the SSE connection when the page is hidden to prevent the Next.js
 * error boundary from triggering on tab-switch. Reconnects with exponential
 * backoff when the tab becomes visible again.
 */
export function LiveDashboard({
  orgId,
  onUpdate,
  fallbackComponent,
}: LiveDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);

  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function clearTimer() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function closeEs() {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    }

    function connect() {
      if (!mountedRef.current || document.visibilityState === 'hidden') return;
      closeEs();
      clearTimer();

      const es = new EventSource(`/api/orgs/${orgId}/dashboard/stream`);
      esRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setReconnectCount(0);
      };

      es.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const newData = JSON.parse(event.data) as DashboardData;
          setData(newData);
          onUpdate?.(newData);
        } catch {
          // malformed SSE payload — ignore
        }
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        closeEs();
        // Only schedule a reconnect when the page is visible; visibilitychange
        // handler will reconnect when the user returns to this tab.
        if (document.visibilityState !== 'hidden') {
          setReconnectCount((prev) => {
            const backoffMs = Math.min(1000 * Math.pow(2, prev), 30_000);
            timerRef.current = setTimeout(() => {
              if (mountedRef.current) connect();
            }, backoffMs);
            return prev + 1;
          });
        }
      };
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        // Re-establish the connection when the user returns to this tab.
        connect();
      } else {
        // Tear down the connection proactively so the browser doesn't keep
        // retrying in the background and triggering error state on re-focus.
        clearTimer();
        closeEs();
        setConnected(false);
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    connect();

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimer();
      closeEs();
    };
  }, [orgId, onUpdate]);

  const statusIndicator = (
    <div className="flex items-center gap-2">
      {connected ? (
        <>
          <Wifi className="w-4 h-4 text-green-600" />
          <span className="text-xs text-green-600">Live</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500">
            {reconnectCount > 0 ? `Reconnecting... (attempt ${reconnectCount})` : 'Offline'}
          </span>
        </>
      )}
    </div>
  );

  if (!data) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">Connecting to live dashboard...</p>
          {statusIndicator}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Live Emissions</h3>
        {statusIndicator}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-600 uppercase">Total CO2e</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {(data.aggregates.totalCo2e / 1000).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-gray-500">tonnes</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-600 uppercase">Scope 1</p>
          <p className="mt-2 text-2xl font-bold text-orange-600">
            {(data.aggregates.scope1 / 1000).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-gray-500">tonnes</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-600 uppercase">Scope 2</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {(data.aggregates.scope2 / 1000).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-gray-500">tonnes</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-600 uppercase">Scope 3</p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            {(data.aggregates.scope3 / 1000).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-gray-500">tonnes</p>
        </div>
      </div>

      {fallbackComponent && (
        <div className="mt-6">
          {fallbackComponent}
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">
        Last updated: {new Date(data.timestamp).toLocaleTimeString()}
      </p>
    </div>
  );
}
