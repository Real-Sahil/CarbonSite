"use client";

import { useActionState, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acceptSupplierInvite } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export default function SupplierInviteAcceptPage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(acceptSupplierInvite, null);
  const [displayName, setDisplayName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setLocalError(null);
    if (!displayName.trim()) {
      setLocalError("Please enter your name or company name");
      return;
    }
    formData.append("token", token);
    formData.append("displayName", displayName);
    await formAction(formData);
  };

  // Handle redirect after success
  if (state?.success && state?.portalToken) {
    router.push(`/supplier-portal/${state.portalToken}`);
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <div className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Welcome!</h1>
            <p className="text-sm text-slate-600">Redirecting to your portal...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <div className="p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">Accept Data Request</h1>
            <p className="text-sm text-slate-600">
              You've been invited to share emissions data. Enter your name to get started.
            </p>
          </div>

          {/* Error Messages */}
          {(state?.error || localError) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">{state?.error || localError}</p>
                {state?.details && (
                  <p className="text-xs text-red-700 mt-1">{state.details}</p>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form action={handleSubmit} className="space-y-4">

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-slate-900 mb-1.5">
                Your Name or Company <span className="text-red-600">*</span>
              </label>
              <Input
                id="displayName"
                type="text"
                placeholder="e.g., John Doe or Acme Corp"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setLocalError(null);
                }}
                disabled={isPending}
                className="h-10"
              />
              {localError && <p className="text-xs text-red-600 mt-1">{localError}</p>}
            </div>

            <Button
              type="submit"
              disabled={isPending || !displayName.trim()}
              className="w-full h-10 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-white font-medium"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                "Accept Invitation"
              )}
            </Button>
          </form>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-600">
              By accepting, you agree to securely share emissions data with the requesting organization.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
