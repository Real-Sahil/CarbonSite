"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AccountPolicies {
  supplierPasswordRotationDays: number | null;
  supplierAccountExpiryDays: number | null;
}

const PASSWORD_ROTATION_OPTIONS = [
  { value: 0, label: "Disabled" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "365 days (1 year)" },
];

const ACCOUNT_EXPIRY_OPTIONS = [
  { value: 0, label: "Disabled" },
  { value: 180, label: "180 days (6 months)" },
  { value: 365, label: "365 days (1 year)" },
  { value: 730, label: "730 days (2 years)" },
];

export function AccountPoliciesSettings() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [policies, setPolicies] = useState<AccountPolicies | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/orgs/${orgId}/settings/account-policies`);
      if (!res.ok) throw new Error("Failed to load policies");
      const data = await res.json();
      setPolicies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!policies) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const res = await fetch(`/api/orgs/${orgId}/settings/account-policies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierPasswordRotationDays: policies.supplierPasswordRotationDays || null,
          supplierAccountExpiryDays: policies.supplierAccountExpiryDays || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save policies");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save policies");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-24" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-32" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!policies) return null;

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">Policies updated successfully</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Password Rotation Policy</CardTitle>
          <CardDescription>
            Require suppliers to reset their passwords at regular intervals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Rotation Interval</Label>
            <div className="flex gap-2 flex-wrap">
              {PASSWORD_ROTATION_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={policies.supplierPasswordRotationDays === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setPolicies({
                      ...policies,
                      supplierPasswordRotationDays: option.value === 0 ? null : option.value,
                    })
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {policies.supplierPasswordRotationDays
                ? `Suppliers must reset their password every ${policies.supplierPasswordRotationDays} days. They'll receive warnings 7 days before expiry.`
                : "Password rotation is disabled."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Expiry Policy</CardTitle>
          <CardDescription>
            Automatically terminate accounts that have been inactive for a specified period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Inactivity Threshold</Label>
            <div className="flex gap-2 flex-wrap">
              {ACCOUNT_EXPIRY_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={policies.supplierAccountExpiryDays === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setPolicies({
                      ...policies,
                      supplierAccountExpiryDays: option.value === 0 ? null : option.value,
                    })
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {policies.supplierAccountExpiryDays
                ? `Accounts with no login activity for ${policies.supplierAccountExpiryDays} days will be automatically terminated. You'll receive a warning 14 days before expiry.`
                : "Account expiry is disabled."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Policies"}
        </Button>
      </div>
    </div>
  );
}
