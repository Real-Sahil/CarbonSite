"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface DataRequest {
  id: string;
  organizationName: string;
  organizationId: string;
  supplierEmail: string;
  emissionCategory: {
    code: string;
    name: string;
    scope: string;
  };
  reportingYear: number;
  dueDate: string;
  status: "sent" | "opened" | "submitted";
}

export default function SupplierDataSubmissionPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [dataRequest, setDataRequest] = useState<DataRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    totalAmount: "",
    unit: "tonnes",
    calculationMethod: "direct",
    notes: "",
    supportingDocuments: "" as string | File[],
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    validateDataRequest();
  }, [token]);

  async function validateDataRequest() {
    try {
      setLoading(true);
      const response = await fetch(`/api/public/supplier-data/${token}/validate`);

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || "Invalid or expired data request");
        return;
      }

      const data = await response.json();
      setDataRequest(data);
      setError(null);
    } catch (err) {
      setError("Failed to load data request");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!dataRequest) return;

    if (!formData.totalAmount) {
      alert("Please enter the emission amount");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`/api/public/supplier-data/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: parseFloat(formData.totalAmount),
          unit: formData.unit,
          calculationMethod: formData.calculationMethod,
          notes: formData.notes,
          emissionCategoryId: dataRequest.emissionCategory.code,
          reportingYear: dataRequest.reportingYear,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit data");
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Failed to submit data", err);
      alert(err instanceof Error ? err.message : "Failed to submit data");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          <p className="text-slate-600">Loading data request...</p>
        </div>
      </div>
    );
  }

  if (error || !dataRequest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Cannot Load Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">{error || "Data request not found"}</p>
            <p className="text-sm text-gray-500">
              The link may have expired or been revoked. Please contact{" "}
              <span className="font-medium">the requesting organization</span> for a new link.
            </p>
            <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Submission Received
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Thank you for submitting your emissions data to{" "}
              <span className="font-medium">{dataRequest.organizationName}</span>.
            </p>
            <p className="text-sm text-gray-500">
              Your submission is now under review. You'll be notified once the review is complete.
            </p>
            <div className="p-3 bg-slate-50 rounded text-sm text-gray-600">
              <p>
                <strong>Submission Details:</strong>
              </p>
              <p className="mt-1">{formData.totalAmount} {formData.unit}</p>
              <p className="text-xs text-gray-500 mt-2">
                Category: {dataRequest.emissionCategory.name}
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/")}
            >
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dueDate = new Date(dataRequest.dueDate);
  const isOverdue = dueDate < new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Submit Emissions Data</CardTitle>
            <CardDescription>
              {dataRequest.organizationName} has requested your emissions data
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {isOverdue && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-700">
                  This request was due on {dueDate.toLocaleDateString()}. Please submit as soon as
                  possible.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Organization
                </p>
                <p className="mt-1 font-medium">{dataRequest.organizationName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Category
                </p>
                <p className="mt-1 font-medium">{dataRequest.emissionCategory.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Reporting Year
                </p>
                <p className="mt-1 font-medium">{dataRequest.reportingYear}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Due Date
                </p>
                <p className="mt-1 font-medium">{dueDate.toLocaleDateString()}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emission Amount *
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.totalAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, totalAmount: e.target.value })
                    }
                    disabled={submitting}
                    required
                  />
                  <Select
                    value={formData.unit}
                    onValueChange={(value) =>
                      setFormData({ ...formData, unit: value })
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tonnes">Tonnes CO₂e</SelectItem>
                      <SelectItem value="kg">kg CO₂e</SelectItem>
                      <SelectItem value="GBP">GBP (Spend)</SelectItem>
                      <SelectItem value="USD">USD (Spend)</SelectItem>
                      <SelectItem value="EUR">EUR (Spend)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Calculation Method
                </label>
                <Select
                  value={formData.calculationMethod}
                  onValueChange={(value) =>
                    setFormData({ ...formData, calculationMethod: value })
                  }
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct Measurement</SelectItem>
                    <SelectItem value="estimate">Industry Estimate</SelectItem>
                    <SelectItem value="audit">Third-Party Audit</SelectItem>
                    <SelectItem value="model">Calculation Model</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes / Assumptions
                </label>
                <Textarea
                  placeholder="Explain your calculation method, assumptions, or any relevant context..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  disabled={submitting}
                  className="min-h-24"
                />
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Next Steps:</strong> After you submit, your data will be reviewed by{" "}
                  {dataRequest.organizationName}. You'll receive a notification when the review is
                  complete.
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Data"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-gray-500 text-center mt-4">
          Your data submission will be securely transmitted and reviewed by authorized staff only.
        </p>
      </div>
    </div>
  );
}
