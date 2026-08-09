"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

/** Map Better Auth error codes to user-readable messages. */
function mapSignInError(err: { code?: string; message?: string } | null | undefined): string {
  if (!err) return "Sign in failed. Please try again.";
  switch (err.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_CREDENTIALS":
      return "Incorrect email or password. Please try again.";
    case "USER_NOT_FOUND":
      return "No account found with that email. Check the address or create an account.";
    case "TOO_MANY_REQUESTS":
    case "RATE_LIMIT_EXCEEDED":
      return "Too many attempts. Please wait a moment and try again.";
    case "EMAIL_NOT_VERIFIED":
      return "Please verify your email address before signing in. Check your inbox for the verification link.";
    case "ACCOUNT_LOCKED":
      return "Your account has been locked. Contact support for help.";
    default:
      return err.message || "Sign in failed. Please check your credentials and try again.";
  }
}

const INPUT_CLS =
  "w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/15 disabled:opacity-50 transition-colors";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });
      if (result.error) {
        setError(mapSignInError(result.error));
        return;
      }
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Welcome back</h1>
        <p className="text-sm text-zinc-500 mt-1.5">Sign in to your CarbonSite account.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-zinc-700 uppercase tracking-wide">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading}
            placeholder="you@company.com"
            className={INPUT_CLS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-medium text-zinc-700 uppercase tracking-wide">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-[#0EA5E9] hover:text-[#0284C7] transition-colors"
              tabIndex={-1}
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            maxLength={128}
            autoComplete="current-password"
            disabled={loading}
            placeholder="••••••••"
            className={INPUT_CLS}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5" role="alert">
            <span className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-[10px] bg-[#0EA5E9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0284C7] active:scale-[0.98] disabled:opacity-60 transition-all"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="text-[#0EA5E9] hover:text-[#0284C7] transition-colors">
          Create account
        </Link>
      </p>
    </div>
  );
}
