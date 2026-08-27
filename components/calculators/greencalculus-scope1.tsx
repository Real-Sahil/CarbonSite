"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertCircle, Flame } from "lucide-react";

export type Scope1FuelType = "natural_gas" | "diesel" | "lpg" | "petrol" | "heating_oil";

interface Scope1CalculatorState {
  fuelType: Scope1FuelType;
  amount: string;
  unit: "kg" | "litre" | "m3" | "kWh";
  result: number | null;
}

const SCOPE1_FACTORS: Record<Scope1FuelType, Record<string, number>> = {
  natural_gas: {
    kg: 1.8443, // kg CO2e per kg
    m3: 1.8443 * 0.717, // kg CO2e per m3 (at STP, 0.717 kg/m3 density)
    kWh: 0.18443, // kg CO2e per kWh
  },
  diesel: {
    kg: 3.1569, // kg CO2e per kg
    litre: 3.1569 * 0.832, // kg CO2e per litre (0.832 kg/litre density)
    kWh: 0.31569, // kg CO2e per kWh
  },
  lpg: {
    kg: 2.9752, // kg CO2e per kg
    litre: 2.9752 * 0.51, // kg CO2e per litre (0.51 kg/litre density)
    kWh: 0.29752, // kg CO2e per kWh
  },
  petrol: {
    kg: 3.1014, // kg CO2e per kg
    litre: 3.1014 * 0.737, // kg CO2e per litre (0.737 kg/litre density)
    kWh: 0.31014, // kg CO2e per kWh
  },
  heating_oil: {
    kg: 3.1449, // kg CO2e per kg
    litre: 3.1449 * 0.85, // kg CO2e per litre (0.85 kg/litre density)
    kWh: 0.31449, // kg CO2e per kWh
  },
};

const FUEL_UNITS: Record<Scope1FuelType, ("kg" | "litre" | "m3" | "kWh")[]> = {
  natural_gas: ["m3", "kWh"],
  diesel: ["litre", "kg"],
  lpg: ["litre", "kg"],
  petrol: ["litre", "kg"],
  heating_oil: ["litre", "kg"],
};

export function Scope1CombustionCalculator() {
  const [state, setState] = useState<Scope1CalculatorState>({
    fuelType: "natural_gas",
    amount: "",
    unit: "m3",
    result: null,
  });

  const availableUnits = FUEL_UNITS[state.fuelType];
  if (!availableUnits.includes(state.unit as any)) {
    setState((s) => ({ ...s, unit: availableUnits[0] }));
  }

  const handleCalculate = () => {
    const amount = parseFloat(state.amount);
    if (!Number.isFinite(amount) || amount < 0) return;

    const factor = SCOPE1_FACTORS[state.fuelType][state.unit];
    const result = amount * factor;
    setState((s) => ({ ...s, result }));
  };

  const handleReset = () => {
    setState({ fuelType: "natural_gas", amount: "", unit: "m3", result: null });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <div>
            <CardTitle>Scope 1 Combustion</CardTitle>
            <CardDescription>Quick fuel-to-CO2e estimate</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fuel-type">Fuel Type</Label>
          <Select value={state.fuelType} onValueChange={(value) => setState((s) => ({ ...s, fuelType: value as Scope1FuelType }))}>
            <SelectTrigger id="fuel-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="natural_gas">Natural Gas</SelectItem>
              <SelectItem value="diesel">Diesel</SelectItem>
              <SelectItem value="petrol">Petrol</SelectItem>
              <SelectItem value="lpg">LPG</SelectItem>
              <SelectItem value="heating_oil">Heating Oil</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0"
              min="0"
              step="0.01"
              value={state.amount}
              onChange={(e) => setState((s) => ({ ...s, amount: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Select value={state.unit} onValueChange={(value) => setState((s) => ({ ...s, unit: value as any }))}>
              <SelectTrigger id="unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableUnits.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {state.result !== null && (
          <div className="rounded-lg bg-green-50 p-3">
            <p className="text-sm font-medium text-green-900">
              {state.amount} {state.unit} → {state.result.toFixed(2)} kg CO2e
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleCalculate} className="flex-1" disabled={!state.amount || !Number.isFinite(parseFloat(state.amount))}>
            Calculate
          </Button>
          <Button onClick={handleReset} variant="outline" className="flex-1">
            Reset
          </Button>
        </div>

        <div className="flex gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>This is a simplified calculator. For compliance reporting, use the full methodology.</p>
        </div>
      </CardContent>
    </Card>
  );
}
