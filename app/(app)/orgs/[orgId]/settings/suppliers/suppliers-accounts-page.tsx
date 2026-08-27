"use client";

import { useEffect, useState } from "react";
import { SupplierAccountsTable } from "./accounts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface SupplierAccount {
  userId: string;
  email: string;
  name: string;
  company?: string;
  status: "active" | "terminated";
  createdAt: string;
  lastLogin?: string;
  terminatedAt?: string;
}

export function SupplierAccountsPage({ orgId }: { orgId: string }) {
  const [accounts, setAccounts] = useState<SupplierAccount[]>([]);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [orgId]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <SupplierAccountsTable
      orgId={orgId}
      accounts={accounts}
      onRefresh={fetchAccounts}
    />
  );
}
