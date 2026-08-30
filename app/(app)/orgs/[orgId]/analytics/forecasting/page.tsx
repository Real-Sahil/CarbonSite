"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ForecastList } from "@/components/analytics/forecast-list";
import { ForecastResults } from "@/components/analytics/forecast-results";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function ForecastingPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [selectedForecast, setSelectedForecast] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [generatingType, setGeneratingType] = useState<string | null>(null);

  const handleGenerateForecast = async (type: "emissions" | "supplier_quality" | "anomaly_rate") => {
    setGeneratingType(type);
    try {
      const response = await fetch(`/api/orgs/${orgId}/forecasts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forecastType: type,
          lookbackMonths: 24,
          forecastMonths: 12,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to queue forecast");
      }

      setRefreshTrigger((t) => t + 1);
      setTimeout(() => setGeneratingType(null), 2000);
    } catch (error) {
      console.error("Forecast generation error:", error);
      setGeneratingType(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Time-Series Forecasting</h1>
        <p className="text-muted-foreground mt-2">
          Predict future emissions, supplier quality trends, and anomaly rates using historical data
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="forecasts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
          <TabsTrigger value="generate">Generate New</TabsTrigger>
        </TabsList>

        <TabsContent value="forecasts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Forecast History</CardTitle>
              <CardDescription>
                Previous forecasts with accuracy metrics and validity information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ForecastList
                orgId={orgId}
                selectedId={selectedForecast}
                onSelectForecast={setSelectedForecast}
                refreshTrigger={refreshTrigger}
              />
            </CardContent>
          </Card>

          {selectedForecast && (
            <div>
              <ForecastResults
                forecastId={selectedForecast}
                orgId={orgId}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Emissions Forecast */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">Emissions Forecast</CardTitle>
                <CardDescription>
                  Predict future emissions based on historical trends using exponential smoothing
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div className="space-y-3 text-sm mb-4">
                  <div>
                    <p className="text-muted-foreground">Method</p>
                    <p className="font-medium">Exponential Smoothing + Seasonality</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Lookback</p>
                    <p className="font-medium">24 months</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Forecast Period</p>
                    <p className="font-medium">12 months</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleGenerateForecast("emissions")}
                  disabled={generatingType !== null}
                  className="w-full"
                >
                  {generatingType === "emissions" && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {generatingType === "emissions" ? "Generating..." : "Generate"}
                </Button>
              </CardContent>
            </Card>

            {/* Supplier Quality Forecast */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">Supplier Quality Forecast</CardTitle>
                <CardDescription>
                  Predict supplier data quality trends over time
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div className="space-y-3 text-sm mb-4">
                  <div>
                    <p className="text-muted-foreground">Method</p>
                    <p className="font-medium">ARIMA with Auto-Selection</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Lookback</p>
                    <p className="font-medium">24 months</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Forecast Period</p>
                    <p className="font-medium">12 months</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleGenerateForecast("supplier_quality")}
                  disabled={generatingType !== null}
                  className="w-full"
                >
                  {generatingType === "supplier_quality" && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {generatingType === "supplier_quality" ? "Generating..." : "Generate"}
                </Button>
              </CardContent>
            </Card>

            {/* Anomaly Rate Forecast */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">Anomaly Rate Forecast</CardTitle>
                <CardDescription>
                  Predict expected number of data quality issues
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div className="space-y-3 text-sm mb-4">
                  <div>
                    <p className="text-muted-foreground">Method</p>
                    <p className="font-medium">Polynomial Regression</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Lookback</p>
                    <p className="font-medium">24 months</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Forecast Period</p>
                    <p className="font-medium">12 months</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleGenerateForecast("anomaly_rate")}
                  disabled={generatingType !== null}
                  className="w-full"
                >
                  {generatingType === "anomaly_rate" && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {generatingType === "anomaly_rate" ? "Generating..." : "Generate"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Forecasts are generated asynchronously. Check the Forecasts tab to see progress. Each forecast
              remains valid for 30 days before you should regenerate it with the latest data.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
