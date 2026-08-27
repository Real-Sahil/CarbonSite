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
import { MoreVertical, Plus } from "lucide-react";
import { format } from "date-fns";
import { CreateAccountDialog } from "./create-account-dialog";
import { PasswordResetDialog } from "./password-reset-dialog";

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

export interface SupplierAccountsProps {
  orgId: string;
  accounts: SupplierAccount[];
  onRefresh: () => void;
}

export function SupplierAccountsTable({ orgId, accounts, onRefresh }: SupplierAccountsProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAccountForReset, setSelectedAccountForReset] = useState<SupplierAccount | null>(null);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

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
          <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Create Account
          </Button>
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
