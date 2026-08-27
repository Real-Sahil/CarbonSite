"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertCircle, Zap } from "lucide-react";

export type Scope2Jurisdiction = "uk_grid" | "eu_grid" | "us_grid" | "au_grid" | "custom";

interface Scope2CalculatorState {
  kWh: string;
  jurisdiction: Scope2Jurisdiction;
  customFactor: string;
  locationBased: number | null;
  marketBased: number | null;
}

const SCOPE2_FACTORS: Record<Scope2Jurisdiction, { locationBased: number; marketBased: number; label: string }> = {
  uk_grid: {
    locationBased: 0.233, // kg CO2e per kWh (2024 average)
    marketBased: 0.05, // kg CO2e per kWh (green tariff default)
    label: "UK Grid (2024)",
  },
  eu_grid: {
    locationBased: 0.24, // kg CO2e per kWh (EU27 average)
    marketBased: 0.08, // kg CO2e per kWh (RECS/I-RECs)
    label: "EU Grid (2024)",
  },
  us_grid: {
    locationBased: 0.387, // kg CO2e per kWh (US average)
    marketBased: 0.1, // kg CO2e per kWh (RECs)
    label: "US Grid (2024)",
  },
  au_grid: {
    locationBased: 0.72, // kg CO2e per kWh (Australian average)
    marketBased: 0.15, // kg CO2e per kWh (GreenPower)
    label: "Australian Grid (2024)",
  },
  custom: {
    locationBased: 0.233,
    marketBased: 0.233,
    label: "Custom",
  },
};

export function Scope2ElectricityCalculator() {
  const [state, setState] = useState<Scope2CalculatorState>({
    kWh: "",
    jurisdiction: "uk_grid",
    customFactor: "0.233",
    locationBased: null,
    marketBased: null,
  });

  const factors = SCOPE2_FACTORS[state.jurisdiction];

  const handleCalculate = () => {
    const kWh = parseFloat(state.kWh);
    if (!Number.isFinite(kWh) || kWh < 0) return;

    if (state.jurisdiction === "custom") {
      const factor = parseFloat(state.customFactor);
      if (!Number.isFinite(factor) || factor < 0) return;
      const result = kWh * factor;
      setState((s) => ({ ...s, locationBased: result, marketBased: result }));
    } else {
      setState((s) => ({
        ...s,
        locationBased: kWh * factors.locationBased,
        marketBased: kWh * factors.marketBased,
      }));
    }
  };

  const handleReset = () => {
    setState({ kWh: "", jurisdiction: "uk_grid", customFactor: "0.233", locationBased: null, marketBased: null });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          <div>
            <CardTitle>Scope 2 Electricity</CardTitle>
            <CardDescription>Dual-reporting calculator</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="kWh">Electricity Consumption (kWh)</Label>
          <Input
            id="kWh"
            type="number"
            placeholder="0"
            min="0"
            step="0.01"
            value={state.kWh}
            onChange={(e) => setState((s) => ({ ...s, kWh: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="jurisdiction">Grid/Jurisdiction</Label>
          <Select value={state.jurisdiction} onValueChange={(value) => setState((s) => ({ ...s, jurisdiction: value as Scope2Jurisdiction }))}>
            <SelectTrigger id="jurisdiction">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="uk_grid">UK Grid (2024)</SelectItem>
              <SelectItem value="eu_grid">EU Grid (2024)</SelectItem>
              <SelectItem value="us_grid">US Grid (2024)</SelectItem>
              <SelectItem value="au_grid">Australian Grid (2024)</SelectItem>
              <SelectItem value="custom">Custom Factor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {state.jurisdiction === "custom" && (
          <div className="space-y-2">
            <Label htmlFor="custom-factor">Custom CO2e Factor (kg CO2e/kWh)</Label>
            <Input
              id="custom-factor"
              type="number"
              placeholder="0.233"
              min="0"
              step="0.001"
              value={state.customFactor}
              onChange={(e) => setState((s) => ({ ...s, customFactor: e.target.value }))}
            />
          </div>
        )}

        {state.locationBased !== null && state.marketBased !== null && (
          <div className="space-y-3 rounded-lg bg-gradient-to-br from-blue-50 to-green-50 p-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-blue-900">Location-Based (Grid Average)</p>
              <p className="text-lg font-bold text-blue-900">{state.locationBased.toFixed(2)} kg CO2e</p>
            </div>
            <div className="h-px bg-gradient-to-r from-blue-200 to-green-200" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-green-900">Market-Based (Green Contract)</p>
              <p className="text-lg font-bold text-green-900">{state.marketBased.toFixed(2)} kg CO2e</p>
            </div>
            {state.marketBased < state.locationBased && (
              <div className="text-xs text-green-800 font-medium">
                ✓ Green contract saves {(state.locationBased - state.marketBased).toFixed(2)} kg CO2e
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleCalculate} className="flex-1" disabled={!state.kWh || !Number.isFinite(parseFloat(state.kWh))}>
            Calculate
          </Button>
          <Button onClick={handleReset} variant="outline" className="flex-1">
            Reset
          </Button>
        </div>

        <div className="flex gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>GHG Protocol requires both methods. Choose location-based for conservative reporting or market-based for green contracts.</p>
        </div>
      </CardContent>
    </Card>
  );
}
