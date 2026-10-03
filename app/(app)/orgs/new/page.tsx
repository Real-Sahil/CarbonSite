"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { COUNTRIES, CURRENCIES, currencyForCountry } from "@/lib/i18n/countries";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function NewOrgPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [hqCountry, setHqCountry] = useState("");
  const [currency, setCurrency] = useState("");
  const [startMonth, setStartMonth] = useState(1);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = "Organisation name is required.";
    }
    if (!hqCountry) {
      errors.hqCountry = "Choose the country your organisation is based in.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry.trim() || undefined,
          hqCountry,
          reportingCurrency: currency || undefined,
          fiscalYearStartMonth: startMonth,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to create organisation. Please try again.");
        return;
      }

      const org = await res.json();
      router.push(`/orgs/${org.id}/dashboard`);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4 py-[76px]">
      <div className="mb-[42px] flex flex-col items-center gap-[7px]">
        <span
          className="text-2xl text-[#111827] tracking-[-0.72px]"
          
        >
          MetricOra
        </span>
        <span className="text-xs text-[#374151] font-normal tracking-[-0.36px]">GHG Emissions Tracking</span>
      </div>
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Create your organisation</CardTitle>
            <CardDescription>
              Set up your organisation to start tracking emissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">
                  Organisation name{" "}
                  <span className="text-red-500" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
                {fieldErrors.name && (
                  <p className="text-sm text-red-600" role="alert">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="industry">Industry (optional)</Label>
                <Input
                  id="industry"
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hqCountry">Country</Label>
                <select
                  id="hqCountry"
                  value={hqCountry}
                  onChange={(e) => { setHqCountry(e.target.value); setCurrency(currencyForCountry(e.target.value) ?? ""); }}
                  disabled={loading}
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">Select a country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                {fieldErrors.hqCountry && (
                  <p className="text-sm text-red-600" role="alert">
                    {fieldErrors.hqCountry}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reportingCurrency">Reporting currency</Label>
                <select
                  id="reportingCurrency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  disabled={loading || !hqCountry}
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                >
                  {!currency && <option value="">Choose a country first</option>}
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fiscalYearStartMonth">Financial year starts</Label>
                <select
                  id="fiscalYearStartMonth"
                  value={startMonth}
                  onChange={(e) => setStartMonth(Number(e.target.value))}
                  disabled={loading}
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full mt-1"
                disabled={loading}
              >
                {loading ? "Creating organisation..." : "Create organisation"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
