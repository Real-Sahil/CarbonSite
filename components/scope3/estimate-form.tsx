"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { Scope3EstimateCard } from "./estimate-card";
import { useScope3Estimate } from "@/lib/hooks/use-scope3-estimate";
import type { Scope3Estimate } from "@/lib/calculation/scope3-estimator";

interface Scope3EstimateFormProps {
  orgId: string;
  onSelect?: (estimate: Scope3Estimate) => void;
  defaultCategory?: string;
  defaultSpend?: number;
}

export function Scope3EstimateForm({
  orgId,
  onSelect,
  defaultCategory,
  defaultSpend,
}: Scope3EstimateFormProps) {
  const { estimate, isLoading, error, requestEstimate } = useScope3Estimate({ orgId });
  const [formData, setFormData] = useState({
    spendCategory: defaultCategory || "s3-purchased-goods",
    spendAmount: defaultSpend || 0,
    industry: "",
    employees: "",
    facilities: "",
    description: "",
  });

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await requestEstimate({
        spendCategory: formData.spendCategory,
        spendAmount: formData.spendAmount || undefined,
        industry: formData.industry || undefined,
        employees: formData.employees ? parseInt(formData.employees) : undefined,
        facilities: formData.facilities ? parseInt(formData.facilities) : undefined,
        description: formData.description || undefined,
      });
    } catch (err) {
      console.error("Estimation failed:", err);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleEstimate} className="space-y-4 rounded-lg border p-4">
        <h3 className="font-semibold">Get a Scope 3 Emissions Estimate</h3>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category">Spend Category</Label>
          <Select
            value={formData.spendCategory}
            onValueChange={(value) => handleChange("spendCategory", value)}
          >
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="s3-business-travel">Business Travel</SelectItem>
              <SelectItem value="s3-purchased-goods">Purchased Goods & Services</SelectItem>
              <SelectItem value="s3-upstream-transport">Upstream Transportation</SelectItem>
              <SelectItem value="s3-commuting">Employee Commuting</SelectItem>
              <SelectItem value="s3-waste">Waste</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Spend Amount */}
        <div className="space-y-2">
          <Label htmlFor="spend">Annual Spend (GBP)</Label>
          <Input
            id="spend"
            type="number"
            placeholder="e.g., 50000"
            value={formData.spendAmount || ""}
            onChange={(e) => handleChange("spendAmount", parseFloat(e.target.value) || 0)}
            step="100"
            min="0"
          />
        </div>

        {/* Industry */}
        <div className="space-y-2">
          <Label htmlFor="industry">Industry (Optional)</Label>
          <Input
            id="industry"
            type="text"
            placeholder="e.g., Construction, Logistics, Retail"
            value={formData.industry}
            onChange={(e) => handleChange("industry", e.target.value)}
          />
        </div>

        {/* Employees */}
        <div className="space-y-2">
          <Label htmlFor="employees">Number of Employees (Optional)</Label>
          <Input
            id="employees"
            type="number"
            placeholder="e.g., 50"
            value={formData.employees}
            onChange={(e) => handleChange("employees", e.target.value)}
            min="1"
          />
        </div>

        {/* Facilities */}
        <div className="space-y-2">
          <Label htmlFor="facilities">Number of Facilities (Optional)</Label>
          <Input
            id="facilities"
            type="number"
            placeholder="e.g., 3"
            value={formData.facilities}
            onChange={(e) => handleChange("facilities", e.target.value)}
            min="1"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Additional Context (Optional)</Label>
          <Textarea
            id="description"
            placeholder="Any additional information to help with the estimate..."
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            rows={3}
          />
        </div>

        {/* Error */}
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</div>}

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Estimating...
            </>
          ) : (
            "Get Estimate"
          )}
        </Button>
      </form>

      {/* Estimate Display */}
      {estimate && (
        <Scope3EstimateCard
          estimate={estimate}
          isLoading={isLoading}
          onAccept={onSelect}
        />
      )}
    </div>
  );
}
