"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { TrendingUp } from "lucide-react";

interface Forecast {
  id: string;
  forecastType: "emissions" | "supplier_quality" | "anomaly_rate";
  targetPeriodStart: string;
  targetPeriodEnd: string;
  accuracy: number;
  method: string;
  trainingDataPoints: number;
  generatedAt: string;
  validUntil: string;
}

interface ForecastListProps {
  orgId: string;
  selectedId?: string | null;
  onSelectForecast: (id: string) => void;
  refreshTrigger?: number;
}

const forecastTypeLabels: Record<string, string> = {
  emissions: "Emissions Forecast",
  supplier_quality: "Supplier Quality",
  anomaly_rate: "Anomaly Rate",
};

const forecastTypeBadgeMap: Record<string, string> = {
  emissions: "bg-blue-100 text-blue-800",
  supplier_quality: "bg-green-100 text-green-800",
  anomaly_rate: "bg-orange-100 text-orange-800",
};

export function ForecastList({
  orgId,
  selectedId,
  onSelectForecast,
  refreshTrigger,
}: ForecastListProps) {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadForecasts = useCallback(async () => {
    try {
      const response = await fetch(`/api/orgs/${orgId}/forecasts`);
      if (!response.ok) throw new Error("Failed to load forecasts");

      const data = await response.json();
      setForecasts(data.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadForecasts();
    const interval = setInterval(loadForecasts, 10000);
    return () => clearInterval(interval);
  }, [loadForecasts, refreshTrigger]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 text-sm">{error}</div>;
  }

  if (forecasts.length === 0) {
    return <div className="text-muted-foreground text-sm">No forecasts yet</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Accuracy (MAPE)</TableHead>
            <TableHead>Training Data</TableHead>
            <TableHead>Generated</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {forecasts.map((forecast) => {
            const isExpired = new Date(forecast.validUntil) < new Date();

            return (
              <TableRow
                key={forecast.id}
                className={`cursor-pointer hover:bg-muted/50 ${
                  selectedId === forecast.id ? "bg-muted" : ""
                }`}
              >
                <TableCell>
                  <Badge className={forecastTypeBadgeMap[forecast.forecastType]}>
                    {forecastTypeLabels[forecast.forecastType]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="text-muted-foreground">
                    {format(new Date(forecast.targetPeriodStart), "MMM d")} -{" "}
                    {format(new Date(forecast.targetPeriodEnd), "MMM d, yyyy")}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{forecast.method}</TableCell>
                <TableCell className="text-sm">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    {forecast.accuracy.toFixed(2)}%
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {forecast.trainingDataPoints} points
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(forecast.generatedAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  {isExpired && (
                    <Badge variant="outline" className="text-xs">
                      Expired
                    </Badge>
                  )}
                  {!isExpired && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectForecast(forecast.id)}
                    >
                      View
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
