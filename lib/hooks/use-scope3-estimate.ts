"use client";

import { useState } from "react";
import type { Scope3Estimate, Scope3EstimateRequest } from "@/lib/calculation/scope3-estimator";

interface UseScope3EstimateOptions {
  orgId: string;
}

export function useScope3Estimate({ orgId }: UseScope3EstimateOptions) {
  const [estimate, setEstimate] = useState<Scope3Estimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestEstimate = async (request: Scope3EstimateRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/scope3/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "estimate",
          ...request,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to estimate emissions");
      }

      const data = await response.json();
      setEstimate(data.estimate);
      return data.estimate;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const suggestCategory = async (description: string, industry?: string): Promise<string> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/scope3/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "suggest",
          description,
          industry,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to suggest category");
      }

      const data = await response.json();
      return data.category;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setEstimate(null);
    setError(null);
  };

  return {
    estimate,
    isLoading,
    error,
    requestEstimate,
    suggestCategory,
    reset,
  };
}
