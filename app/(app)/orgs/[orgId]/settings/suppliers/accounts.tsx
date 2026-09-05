"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Plus, Upload, AlertTriangle, Clock } from "lucide-react";
import { format, subDays } from "date-fns";
import { CreateAccountDialog } from "./create-account-dialog";
import { PasswordResetDialog } from "./password-reset-dialog";
import { BulkImportDialog } from "./bulk-import-dialog";

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

export interface SupplierAccountsProps {
  orgId: string;
  accounts: SupplierAccount[];
  policies: AccountPolicies | null;
  onRefresh: () => void;
}

export function SupplierAccountsTable({ orgId, accounts, policies, onRefresh }: SupplierAccountsProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedAccountForReset, setSelectedAccountForReset] = useState<SupplierAccount | null>(null);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const getPasswordExpiryStatus = (account: SupplierAccount): { isExpired: boolean; daysUntil?: number } => {
    if (!policies?.supplierPasswordRotationDays || policies.supplierPasswordRotationDays === 0) {
      return { isExpired: false };
    }
    if (!account.passwordChangedAt) {
      return { isExpired: true, daysUntil: 0 };
    }
    const passwordChangedAt = new Date(account.passwordChangedAt);
    const expiryDate = subDays(new Date(), -policies.supplierPasswordRotationDays);
    const daysUntil = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return { isExpired: daysUntil <= 0, daysUntil: Math.max(0, daysUntil) };
  };

  const getInactivityStatus = (account: SupplierAccount): { isExpiring: boolean; daysUntil?: number } => {
    if (!policies?.supplierAccountExpiryDays || policies.supplierAccountExpiryDays === 0) {
      return { isExpiring: false };
    }
    if (!account.lastLogin) {
      const accountAgeInDays = Math.ceil((new Date().getTime() - new Date(account.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return { isExpiring: accountAgeInDays >= policies.supplierAccountExpiryDays, daysUntil: 0 };
    }
    const lastLoginDate = new Date(account.lastLogin);
    const expiryDate = subDays(new Date(), -policies.supplierAccountExpiryDays);
    const daysUntil = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return { isExpiring: daysUntil <= 14, daysUntil: Math.max(0, daysUntil) };
  };

  const handleTerminate = async (userId: string, account: SupplierAccount) => {
    if (!confirm(`Are you sure you want to terminate the account for ${account.email}?`)) return;

    setLoadingUserId(userId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/supplier-accounts/${userId}/terminate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "terminate" }),
      });

      if (!res.ok) {
        throw new Error("Failed to terminate account");
      }

      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to terminate account");
    } finally {
      setLoadingUserId(null);
    }
  };

  const handleReactivate = async (userId: string, account: SupplierAccount) => {
    if (!confirm(`Are you sure you want to reactivate the account for ${account.email}?`)) return;

    setLoadingUserId(userId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/supplier-accounts/${userId}/terminate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });

      if (!res.ok) {
        throw new Error("Failed to reactivate account");
      }

      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reactivate account");
    } finally {
      setLoadingUserId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Supplier Accounts</CardTitle>
            <CardDescription>Manage supplier login credentials and access</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowImportDialog(true)} size="sm" variant="outline" className="gap-1">
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Create Account
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-zinc-500">No supplier accounts yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="px-4 py-3 text-left font-medium text-zinc-600">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-600">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-600">Company</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-600">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-600">Policy Alerts</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-600">Created</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-600">Last Login</th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.userId} className="border-b border-zinc-200 hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">{account.email}</td>
                      <td className="px-4 py-3 text-zinc-600">{account.name}</td>
                      <td className="px-4 py-3 text-zinc-600">{account.company || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={account.status === "active" ? "default" : "secondary"}>
                          {account.status === "active" ? "Active" : "Terminated"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {(() => {
                            const passwordStatus = getPasswordExpiryStatus(account);
                            const inactivityStatus = getInactivityStatus(account);
                            const badges = [];

                            if (passwordStatus.isExpired) {
                              badges.push(
                                <Badge key="password" variant="destructive" className="gap-1 w-fit">
                                  <AlertTriangle className="h-3 w-3" />
                                  Password expired
                                </Badge>
                              );
                            } else if (passwordStatus.daysUntil !== undefined && passwordStatus.daysUntil <= 7) {
                              badges.push(
                                <Badge key="password" variant="outline" className="gap-1 w-fit border-orange-300 text-orange-700">
                                  <Clock className="h-3 w-3" />
                                  {passwordStatus.daysUntil}d
                                </Badge>
                              );
                            }

                            if (inactivityStatus.isExpiring && account.status === "active") {
                              badges.push(
                                <Badge key="inactivity" variant="outline" className="gap-1 w-fit border-yellow-300 text-yellow-700">
                                  <Clock className="h-3 w-3" />
                                  {inactivityStatus.daysUntil}d
                                </Badge>
                              );
                            }

                            return badges.length > 0 ? badges : <span className="text-xs text-zinc-500">None</span>;
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {format(new Date(account.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {account.lastLogin ? format(new Date(account.lastLogin), "MMM d, yyyy") : "Never"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={loadingUserId === account.userId}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setSelectedAccountForReset(account)}
                              disabled={account.status === "terminated"}
                            >
                              Reset Password
                            </DropdownMenuItem>
                            {account.status === "active" ? (
                              <DropdownMenuItem
                                onClick={() => handleTerminate(account.userId, account)}
                                className="text-red-600"
                              >
                                Terminate Account
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleReactivate(account.userId, account)}>
                                Reactivate Account
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateAccountDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} orgId={orgId} onSuccess={onRefresh} />

      <BulkImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={onRefresh}
      />

      {selectedAccountForReset && (
        <PasswordResetDialog
          account={selectedAccountForReset}
          orgId={orgId}
          onClose={() => setSelectedAccountForReset(null)}
          onSuccess={() => {
            setSelectedAccountForReset(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
