"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
});

interface InviteData {
  id: string;
  email: string;
  companyName: string | null;
  organizationName: string;
  organizationId: string;
  expiresAt: string;
  usedAt: string | null;
}

export default function SupplierInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    async function validateInvite() {
      try {
        const res = await fetch(`/api/public/supplier-invites/${token}/validate`, {
          method: "GET",
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.message || "Invalid or expired invitation");
          return;
        }

        const data = await res.json();
        setInviteData(data);
      } catch (err) {
        setError("Failed to validate invitation. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    validateInvite();
  }, [token]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!inviteData) return;

    setValidationError(null);

    // Validate form
    const validationResult = schema.safeParse({
      password,
      confirmPassword,
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      setValidationError(firstError.message);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/supplier/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteData.email,
          password,
          inviteToken: token,
          organizationId: inviteData.organizationId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Registration failed");
        return;
      }

      router.push("/sign-in?supplier=true&email=" + encodeURIComponent(inviteData.email));
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invitation Invalid</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button className="mt-4 w-full" onClick={() => router.push("/")}>
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteData) {
    return null;
  }

  const expiresAt = new Date(inviteData.expiresAt);
  const isExpired = expiresAt < new Date();
  const daysUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {inviteData.organizationName}</CardTitle>
          <CardDescription>
            Set up your supplier account to submit emissions data
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isExpired ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This invitation has expired. Please contact {inviteData.organizationName} to request a new one.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="mb-4 space-y-3 rounded-lg bg-blue-50 p-3">
              <p className="text-sm font-medium text-gray-700">
                Email: <span className="font-semibold">{inviteData.email}</span>
              </p>
              {inviteData.companyName && (
                <p className="text-sm font-medium text-gray-700">
                  Company: <span className="font-semibold">{inviteData.companyName}</span>
                </p>
              )}
              <p className="text-xs text-gray-600">
                Invitation expires in {daysUntilExpiry} days
              </p>
            </div>
          )}

          {!isExpired && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
                <p className="text-xs text-gray-600 mt-2">
                  Use a strong password with uppercase, lowercase, numbers, and symbols
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {validationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || isExpired}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-xs text-gray-500">
            Already have an account?{" "}
            <a href="/sign-in" className="text-blue-600 hover:underline">
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
