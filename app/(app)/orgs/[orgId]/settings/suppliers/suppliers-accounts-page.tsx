"use client";

import { useEffect, useState } from "react";
import { SupplierAccountsTable } from "./accounts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

interface SupplierAccount {
  userId: string;
  email: string;
  name: string;
  company?: string;
  status: "active" | "terminated";
  createdAt: string;
  passwordChangedAt?: string;
  lastLogin?: string;
  terminatedAt?: string;
}

interface AccountPolicies {
  supplierPasswordRotationDays: number | null;
  supplierAccountExpiryDays: number | null;
}

export function SupplierAccountsPage({ orgId }: { orgId: string }) {
  const [accounts, setAccounts] = useState<SupplierAccount[]>([]);
  const [policies, setPolicies] = useState<AccountPolicies | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const fetchAccounts = async () => {
    try {
      setError("");
      const res = await fetch(`/api/orgs/${orgId}/supplier-accounts`);
      if (!res.ok) {
        throw new Error("Failed to load accounts");
      }
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    }
  };

  const fetchPolicies = async () => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/settings/account-policies`);
      if (!res.ok) {
        throw new Error("Failed to load policies");
      }
      const data = await res.json();
      setPolicies(data);
    } catch (err) {
      console.error("Failed to load policies:", err);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAccounts(), fetchPolicies()]).finally(() => setLoading(false));
  }, [orgId]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200">
          <div className="p-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <SupplierAccountsTable
      orgId={orgId}
      accounts={accounts}
      policies={policies}
      onRefresh={fetchAccounts}
    />
  );
}
