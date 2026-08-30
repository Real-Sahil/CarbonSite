"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, X } from "lucide-react";

const formSchema = z.object({
  question: z.string().min(10, "Question must be at least 10 characters").max(500),
  treatmentVariable: z.string().min(1, "Treatment variable is required").max(100),
  outcomeVariable: z.string().min(1, "Outcome variable is required").max(100),
  confounders: z.array(z.string().max(100)).max(10),
  selectedModelId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CausalAnalysisFormProps {
  orgId: string;
  onAnalysisCreated: () => void;
}

export function CausalAnalysisForm({ orgId, onAnalysisCreated }: CausalAnalysisFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confounders, setConfounders] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    question: "",
    treatmentVariable: "",
    outcomeVariable: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const values: FormValues = {
        ...formData,
        confounders,
      };

      // Validate
      const validated = formSchema.parse(values);

      const response = await fetch(`/api/orgs/${orgId}/causal-analyses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to create analysis");
      }

      setSuccessMessage(`Analysis "${formData.question}" has been queued for processing`);
      setFormData({
        question: "",
        treatmentVariable: "",
        outcomeVariable: "",
      });
      setConfounders([]);
      onAnalysisCreated();

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0]?.message || "Validation error");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert>
          <AlertDescription className="text-green-800 bg-green-50">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Question */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Research Question</label>
        <Textarea
          placeholder="e.g., What is the causal effect of fleet electrification on our Scope 1 emissions?"
          className="resize-none"
          rows={3}
          value={formData.question}
          onChange={(e) => setFormData({ ...formData, question: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          A clear question about what you want to understand (10-500 characters)
        </p>
      </div>

      {/* Treatment Variable */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Treatment Variable</label>
        <Input
          placeholder="e.g., vehicle_electrification_percent"
          value={formData.treatmentVariable}
          onChange={(e) => setFormData({ ...formData, treatmentVariable: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          The intervention or change you&apos;re studying
        </p>
      </div>

      {/* Outcome Variable */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Outcome Variable</label>
        <Input
          placeholder="e.g., scope1_emissions_kg"
          value={formData.outcomeVariable}
          onChange={(e) => setFormData({ ...formData, outcomeVariable: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          What you&apos;re trying to measure or predict
        </p>
      </div>

      {/* Confounders */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Confounding Variables (Optional)</label>
          <p className="text-xs text-muted-foreground">
            Other factors that might affect both treatment and outcome. Add up to 10.
          </p>
        </div>

        {confounders.length > 0 && (
          <div className="space-y-2">
            {confounders.map((confounder, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="e.g., facility_size_sqm"
                  value={confounder}
                  onChange={(e) => {
                    const newConfounders = [...confounders];
                    newConfounders[index] = e.target.value;
                    setConfounders(newConfounders);
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfounders(confounders.filter((_, i) => i !== index))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {confounders.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfounders([...confounders, ""])}
          >
            Add Confounder
          </Button>
        )}

        {confounders.length === 10 && (
          <p className="text-sm text-muted-foreground">Maximum 10 confounders reached</p>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? "Queuing Analysis..." : "Run Analysis"}
      </Button>
    </form>
  );
}
