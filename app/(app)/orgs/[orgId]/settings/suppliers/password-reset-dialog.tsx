"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";

interface SupplierAccount {
  userId: string;
  email: string;
  name: string;
}

interface PasswordResetDialogProps {
  account: SupplierAccount;
  orgId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PasswordResetDialog({ account, orgId, onClose, onSuccess }: PasswordResetDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");

  const handleReset = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/orgs/${orgId}/supplier-accounts/${account.userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to reset password");
      }

      const data = await res.json();
      setNewPassword(data.newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (newPassword) {
      onClose();
      onSuccess();
    } else if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={!!account} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Generate a new temporary password for {account.email}</DialogDescription>
        </DialogHeader>

        {newPassword ? (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">Password reset successfully!</AlertDescription>
            </Alert>

            <div className="space-y-3 rounded-lg bg-zinc-50 p-4">
              <div>
                <p className="text-xs text-zinc-600">New Temporary Password</p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 font-mono text-sm font-medium text-zinc-900">{newPassword}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(newPassword);
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Share this new password with the supplier. They can reset it after logging in.
              </AlertDescription>
            </Alert>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <p className="text-sm text-zinc-600">
              This will generate a new temporary password for <span className="font-medium">{account.name}</span>
            </p>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleReset} disabled={loading} className="flex-1">
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
