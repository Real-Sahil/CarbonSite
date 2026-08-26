"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

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
      return "Please verify your email address before signing in.";
    case "ACCOUNT_LOCKED":
      return "Your account has been locked. Contact support for help.";
    default:
      return err.message || "Sign in failed. Please check your credentials and try again.";
  }
}

const INPUT_CLS =
  "w-full rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-amber-500/60 focus:bg-white/8 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-40 transition-all";

export default function SignInPage() {
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
      window.location.href = "/app";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-white">Welcome back</h1>
        <p className="text-sm text-white/40 mt-1">Sign in to your CarbonSite account.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[11px] font-medium text-white/40 uppercase tracking-[0.08em]">
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
            <label htmlFor="password" className="text-[11px] font-medium text-white/40 uppercase tracking-[0.08em]">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs text-amber-400 hover:text-amber-300 transition-colors" tabIndex={-1}>
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
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5" role="alert">
            <span className="mt-0.5 text-red-400" aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:shadow-[0_0_28px_rgba(245,158,11,0.5)] hover:from-orange-400 hover:to-amber-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/30">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="text-amber-400 hover:text-amber-300 transition-colors">
          Create account
        </Link>
      </p>
    </div>
  );
}
