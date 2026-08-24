"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const UNITS = [
  { value: "kg",     label: "kg — kilograms" },
  { value: "tonne",  label: "tonne — metric tonnes" },
  { value: "kWh",    label: "kWh — kilowatt-hours" },
  { value: "MWh",    label: "MWh — megawatt-hours" },
  { value: "litre",  label: "litre — litres" },
  { value: "m3",     label: "m³ — cubic metres" },
  { value: "GBP",    label: "£ — spend (GBP)" },
  { value: "piece",  label: "piece — units / items" },
];

const SCOPE_GUIDANCE: Record<string, { hint: string; example: string }> = {
  "business travel": {
    hint: "Total distance travelled or spend on flights, trains, hotels.",
    example: "e.g. 45,000 km or £12,000",
  },
  "purchased goods": {
    hint: "Annual spend on goods and services, or weight of materials purchased.",
    example: "e.g. £250,000 or 12 tonne",
  },
  "upstream transport": {
    hint: "Weight × distance (tonne-km) or annual freight spend.",
    example: "e.g. 180,000 tonne-km or £8,500",
  },
  "employee commuting": {
    hint: "Estimated total employee commuting distance or modal split.",
    example: "e.g. 320,000 km",
  },
};

interface SupplierDataFormProps {
  token: string;
  orgName: string;
  categoryCode: string;
  categoryName: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  expiresAt: string;
  expired: boolean;
  submitted: boolean;
}

export function SupplierDataForm({
  token,
  orgName,
  categoryName,
  periodLabel,
  notes,
  expiresAt,
  expired,
  submitted: initialSubmitted,
}: SupplierDataFormProps) {
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("tonne");
  const [description, setDescription] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(initialSubmitted);

  const expires = new Date(expiresAt);
  const guidance = SCOPE_GUIDANCE[categoryName.toLowerCase()] ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const qty = Number(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      setError("Please enter a valid quantity greater than zero.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/supplier-data/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: qty,
          unit,
          description: description.trim() || undefined,
          supplierName: supplierName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Submission failed. Please try again.");
        return;
      }

      setDone(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            Data submitted — thank you
          </CardTitle>
          <CardDescription>
            {orgName} has received your emissions data for {periodLabel}.
            No further action is needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            If you need to update your submission, please contact {orgName} directly.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (expired) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleAlert className="h-4 w-4 text-red-600" />
            Request has expired
          </CardTitle>
          <CardDescription>
            This data request expired on{" "}
            {expires.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            . Please contact {orgName} to receive a new link.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Context card */}
      <Card className="border-sky-100 bg-sky-50">
        <CardContent className="pt-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Category</dt>
              <dd className="font-medium text-slate-900 capitalize">{categoryName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Reporting period</dt>
              <dd className="font-medium text-slate-900">{periodLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Requested by</dt>
              <dd className="font-medium text-slate-900">{orgName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Deadline</dt>
              <dd className="font-medium text-slate-900">
                {expires.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </dd>
            </div>
          </dl>
          {notes && (
            <p className="mt-3 border-t border-sky-100 pt-3 text-sm text-slate-600">
              <span className="font-medium">Note from {orgName}:</span> {notes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Guidance */}
      {guidance && (
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          <div className="text-sm text-slate-600">
            <p>{guidance.hint}</p>
            <p className="mt-0.5 text-slate-400">{guidance.example}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enter your data</CardTitle>
          <CardDescription>
            Provide your best estimate for the full reporting period. You can add
            a description if the figure needs context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-name">Your name or company (optional)</Label>
              <Input
                id="supplier-name"
                placeholder="Acme Logistics Ltd"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="unit">Unit *</Label>
                <Select value={unit} onValueChange={setUnit} disabled={loading}>
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">
                Description{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <Textarea
                id="description"
                placeholder="e.g. Total road freight for UK operations Jan–Dec 2025. Excludes last-mile delivery."
                rows={3}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
              <p className="text-right text-xs text-slate-400">
                {description.length}/500
              </p>
            </div>

            {error && (
              <p
                className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Submitting..." : "Submit data"}
            </Button>

            <p className="flex items-start gap-2 text-xs text-slate-400">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
              Your data is only used for {orgName}&apos;s GHG inventory and is
              not shared with third parties.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
