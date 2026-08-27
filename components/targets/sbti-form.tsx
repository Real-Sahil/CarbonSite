"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { SBTiPathwayCard, SBTiComparison } from "./sbti-pathway-card";
import type { SBTiPathwayResult } from "@/lib/calculation/sbti-calculator";

interface SBTiFormProps {
  orgId: string;
  currentEmissions?: number;
  currentYear?: number;
  onPathwaySelect?: (pathway: SBTiPathwayResult) => void;
}

export function SBTiForm({
  orgId,
  currentEmissions = 0,
  currentYear = new Date().getFullYear(),
  onPathwaySelect,
}: SBTiFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathways, setPathways] = useState<SBTiPathwayResult[]>([]);
  const [formData, setFormData] = useState({
    baselineYear: currentYear - 1,
    baselineEmissions: currentEmissions,
    targetYear: currentYear + 6, // default: 6 years out
    pathway: "1.5C" as const,
    scope1: 0,
    scope2: 0,
    scope3: 0,
  });

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field.startsWith("scope") ? Math.max(0, Number(value)) : value,
    }));
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const pathwaysList: SBTiPathwayResult[] = [];

      for (const pathway of ["1.5C", "2C", "2.5C"] as const) {
        const response = await fetch(`/api/orgs/${orgId}/targets/sbti-pathway`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baselineYear: formData.baselineYear,
            baselineEmissions: formData.baselineEmissions,
            targetYear: formData.targetYear,
            pathway,
            scope1: formData.scope1 || undefined,
            scope2: formData.scope2 || undefined,
            scope3: formData.scope3 || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to calculate pathway");
        }

        const data = await response.json();
        pathwaysList.push(data.pathway);
      }

      setPathways(pathwaysList);
      // Auto-select the 1.5C pathway for display
      if (onPathwaySelect && pathwaysList[0]) {
        onPathwaySelect(pathwaysList[0]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to calculate pathways";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calculate Science-Based Targets</CardTitle>
          <CardDescription>Determine annual reduction requirements to meet climate goals</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleCalculate} className="space-y-6">
            {/* Baseline */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="baselineYear">Baseline Year</Label>
                <Input
                  id="baselineYear"
                  type="number"
                  min="2000"
                  max={new Date().getFullYear()}
                  value={formData.baselineYear}
                  onChange={(e) => handleChange("baselineYear", parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baselineEmissions">Baseline Emissions (kg CO₂e)</Label>
                <Input
                  id="baselineEmissions"
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.baselineEmissions}
                  onChange={(e) => handleChange("baselineEmissions", parseFloat(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Target Year */}
            <div className="space-y-2">
              <Label htmlFor="targetYear">Target Year</Label>
              <Input
                id="targetYear"
                type="number"
                min={formData.baselineYear + 1}
                max="2100"
                value={formData.targetYear}
                onChange={(e) => handleChange("targetYear", parseInt(e.target.value))}
              />
              <p className="text-xs text-gray-500">
                {formData.targetYear - formData.baselineYear} years from baseline
              </p>
            </div>

            {/* Pathway Selection */}
            <div className="space-y-3">
              <Label>Climate Pathway</Label>
              <RadioGroup
                value={formData.pathway}
                onValueChange={(value) => handleChange("pathway", value)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1.5C" id="pathway-1.5" />
                  <Label htmlFor="pathway-1.5" className="cursor-pointer font-normal">
                    <span className="font-medium">1.5°C</span> - Paris Agreement limit (most ambitious)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="2C" id="pathway-2" />
                  <Label htmlFor="pathway-2" className="cursor-pointer font-normal">
                    <span className="font-medium">2°C</span> - Challenging but achievable
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="2.5C" id="pathway-2.5" />
                  <Label htmlFor="pathway-2.5" className="cursor-pointer font-normal">
                    <span className="font-medium">2.5°C</span> - Moderate pathway
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Scope Breakdown (Optional) */}
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Emissions Breakdown (Optional)</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Provide scope breakdown for tailored recommendations
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="scope1">Scope 1 (Direct)</Label>
                  <Input
                    id="scope1"
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.scope1 || ""}
                    onChange={(e) => handleChange("scope1", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scope2">Scope 2 (Energy)</Label>
                  <Input
                    id="scope2"
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.scope2 || ""}
                    onChange={(e) => handleChange("scope2", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scope3">Scope 3 (Indirect)</Label>
                  <Input
                    id="scope3"
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.scope3 || ""}
                    onChange={(e) => handleChange("scope3", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                {error}
              </div>
            )}

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculating Pathways...
                </>
              ) : (
                "Calculate All Pathways"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {pathways.length > 0 && (
        <>
          {/* Comparison */}
          <SBTiComparison pathways={pathways} />

          {/* Detailed Pathways */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Detailed Pathways</h3>
            {pathways.map((pathway) => (
              <SBTiPathwayCard key={pathway.pathway} pathway={pathway} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
