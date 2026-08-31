"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { useEffect } from "react";

interface RequestData {
  id: string;
  categoryCode: string;
  categoryName: string;
  status: string;
  deadline: string;
  periodLabel: string;
  submittedData: { quantity: number; unit: string; description?: string | null } | null;
  qualityFlags: Array<{
    field: string;
    severity: "warning" | "critical" | "info";
    message: string;
    suggestedRange?: { min: number; max: number };
  }> | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
}

export default function RequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  const router = useRouter();
  const [request, setRequest] = useState<RequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  useEffect(() => {
    // Fetch request details from API
    const fetchRequest = async () => {
      try {
        const res = await fetch(`/api/supplier-portal/requests/${requestId}`);
        if (!res.ok) {
          throw new Error("Failed to load request");
        }
        const data = await res.json();
        setRequest(data);
        if (data.submittedData) {
          setQuantity(data.submittedData.quantity.toString());
          setUnit(data.submittedData.unit);
          setDescription(data.submittedData.description || "");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load request");
      } finally {
        setLoading(false);
      }
    };

    fetchRequest();
  }, [requestId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!quantity || !unit) {
      setError("Quantity and unit are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/supplier-portal/requests/${requestId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: parseFloat(quantity),
          unit,
          description: description || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Submission failed");
      }

      setSuccess("Submission received successfully");
      setTimeout(() => router.push("/supplier-portal"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">Loading request...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Request not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isExpired = new Date(request.deadline) < new Date() && request.status !== "submitted";
  const isApproved = request.status === "approved";
  const isRejected = request.status === "rejected";
  const canSubmit = ["sent", "opened", "rejected"].includes(request.status) && !isExpired;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Back button */}
        <Button variant="ghost" onClick={() => router.push("/supplier-portal")} className="mb-6">
          ← Back to Dashboard
        </Button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{request.categoryName}</h1>
              <p className="mt-1 text-zinc-600">{request.periodLabel}</p>
            </div>
            <Badge variant={isApproved ? "default" : isRejected ? "destructive" : "outline"}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Status alerts */}
        {isExpired && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>This request has expired and is no longer accepting submissions.</AlertDescription>
          </Alert>
        )}

        {isApproved && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Your submission has been approved. Thank you!
            </AlertDescription>
          </Alert>
        )}

        {isRejected && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your submission was rejected. Please review the feedback below and resubmit.
            </AlertDescription>
          </Alert>
        )}

        {/* Rejection reason */}
        {request.rejectionReason && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-base">Rejection Reason</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-amber-900">{request.rejectionReason}</p>
            </CardContent>
          </Card>
        )}

        {/* Quality flags */}
        {request.qualityFlags && request.qualityFlags.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Quality Concerns</CardTitle>
              <CardDescription>Please review these items before resubmitting</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {request.qualityFlags.map((flag, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Badge variant={flag.severity === "critical" ? "destructive" : "secondary"} className="mt-0.5">
                      {flag.severity}
                    </Badge>
                    <div>
                      <p className="font-medium text-zinc-900">{flag.field}</p>
                      <p className="text-sm text-zinc-600">{flag.message}</p>
                      {flag.suggestedRange && (
                        <p className="text-xs text-zinc-500">
                          Suggested range: {flag.suggestedRange.min} — {flag.suggestedRange.max}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Submission form */}
        {canSubmit && (
          <Card>
            <CardHeader>
              <CardTitle>Submit Data</CardTitle>
              <CardDescription>Provide your emissions data for this category and period</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">{success}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.01"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="e.g., 1000"
                      required
                      disabled={submitting || isApproved}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="e.g., kg, tonnes, kWh"
                      required
                      disabled={submitting || isApproved}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Notes (optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Any additional notes or clarifications"
                    rows={3}
                    disabled={submitting || isApproved}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting || isApproved}>
                    {submitting ? "Submitting..." : "Submit Data"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push("/supplier-portal")}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* View only for approved */}
        {isApproved && (
          <Card>
            <CardHeader>
              <CardTitle>Your Submission</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-zinc-600">Quantity</p>
                    <p className="text-lg font-medium">{request.submittedData?.quantity}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-600">Unit</p>
                    <p className="text-lg font-medium">{request.submittedData?.unit}</p>
                  </div>
                </div>
                {request.submittedData?.description && (
                  <div>
                    <p className="text-sm text-zinc-600">Notes</p>
                    <p className="text-sm">{request.submittedData.description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
