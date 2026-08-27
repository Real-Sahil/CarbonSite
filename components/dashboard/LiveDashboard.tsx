'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';

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
 * Shows live emission totals as calculations complete.
 * Automatically reconnects on connection loss with exponential backoff.
 */
export function LiveDashboard({
  orgId,
  onUpdate,
  fallbackComponent,
}: LiveDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isCleaningUp = false;

    const connect = () => {
      try {
        eventSource = new EventSource(
          `/api/orgs/${orgId}/dashboard/stream`
        );

        eventSource.onopen = () => {
          setConnected(true);
          setError(null);
          setReconnectAttempt(0);
        };

        eventSource.onmessage = (event) => {
          try {
            const newData = JSON.parse(event.data) as DashboardData;
            setData(newData);
            onUpdate?.(newData);
          } catch (err) {
            console.error('Error parsing SSE data:', err);
          }
        };

        eventSource.onerror = () => {
          setConnected(false);

          if (eventSource?.readyState === EventSource.CLOSED) {
            setError('Connection closed');
          } else if (
            eventSource?.readyState === EventSource.CONNECTING
          ) {
            // Browser will auto-retry, exponential backoff
            setReconnectAttempt((prev) => {
              const nextAttempt = prev + 1;
              const backoffMs = Math.min(1000 * Math.pow(2, prev), 30000);

              if (!isCleaningUp) {
                reconnectTimer = setTimeout(() => {
                  if (!isCleaningUp) {
                    connect();
                  }
                }, backoffMs);
              }

              return nextAttempt;
            });
          }
        };
      } catch (err) {
        setConnected(false);
        setError(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}`);

        setReconnectAttempt((prev) => {
          const nextAttempt = prev + 1;
          const backoffMs = Math.min(1000 * Math.pow(2, prev), 30000);

          if (!isCleaningUp) {
            reconnectTimer = setTimeout(connect, backoffMs);
          }

          return nextAttempt;
        });
      }
    };

    connect();

    return () => {
      isCleaningUp = true;
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [orgId, onUpdate]);

  // Connection status indicator
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
            {reconnectAttempt > 0 ? `Reconnecting... (attempt ${reconnectAttempt})` : 'Offline'}
          </span>
        </>
      )}
    </div>
  );

  // Error display
  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-red-900">Dashboard Error</h3>
            <p className="text-sm text-red-800 mt-1">{error}</p>
            <p className="text-xs text-red-700 mt-2">
              {reconnectAttempt > 0 && `Retrying in ${Math.min(1000 * Math.pow(2, reconnectAttempt), 30000) / 1000}s...`}
            </p>
          </div>
          {statusIndicator}
        </div>
      </div>
    );
  }

  // Loading state
  if (!data && !error) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">Connecting to live dashboard...</p>
          {statusIndicator}
        </div>
      </div>
    );
  }

  // Display data with status indicator
  if (data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Live Emissions</h3>
          {statusIndicator}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-600 uppercase">Total CO₂e</p>
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

  return fallbackComponent || null;
}
