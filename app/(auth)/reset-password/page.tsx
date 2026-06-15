"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const tokenError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (tokenError === "INVALID_TOKEN") {
      setError("This reset link is invalid or has expired. Please request a new one.");
    }
  }, [tokenError]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password.length > 128) {
      setError("Password must not exceed 128 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Reset token is missing. Please use the link from your email.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password, token }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Could not reset password. The link may have expired.");
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/sign-in"), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Password updated</CardTitle>
          <CardDescription>
            Your password has been reset successfully. Redirecting you to sign in…
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/sign-in" className="text-sm text-[#0f3e17] hover:underline">
            Sign in now
          </Link>
        </CardFooter>
      </Card>
    );
  }

  if (!token && !tokenError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Invalid link</CardTitle>
          <CardDescription>
            This reset link is missing its token. Please use the link from your email.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/forgot-password" className="text-sm text-[#0f3e17] hover:underline">
            Request a new link
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>
          Must be at least 8 characters.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              disabled={loading || Boolean(tokenError)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              disabled={loading || Boolean(tokenError)}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {!tokenError && (
            <Button type="submit" className="w-full mt-1" disabled={loading}>
              {loading ? "Updating..." : "Reset password"}
            </Button>
          )}
          {tokenError && (
            <Link
              href="/forgot-password"
              className="text-sm text-center text-[#0f3e17] hover:underline"
            >
              Request a new reset link
            </Link>
          )}
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <Link href="/sign-in" className="text-sm text-[#0f3e17] hover:underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
