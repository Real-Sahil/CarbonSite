"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { ArrowRight, Building2 } from "lucide-react";

type Step = "account" | "org";

function mapSignUpError(err: { code?: string; message?: string } | null | undefined): string {
  if (!err) return "Could not create account. Please try again.";
  switch (err.code) {
    case "USER_ALREADY_EXISTS":
    case "EMAIL_ALREADY_EXISTS":
    case "EMAIL_TAKEN":
      return "An account with this email already exists. Sign in instead, or reset your password.";
    case "INVALID_EMAIL":
      return "That doesn't look like a valid email address.";
    case "INVALID_PASSWORD":
    case "PASSWORD_TOO_SHORT":
      return "Password must be at least 8 characters.";
    case "TOO_MANY_REQUESTS":
    case "RATE_LIMIT_EXCEEDED":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return err.message || "Could not create account. Please try again.";
  }
}

const INPUT_CLS =
  "w-full rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-amber-500/60 focus:bg-white/8 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-40 transition-all";

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("account");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password.length > 128) { setError("Password must not exceed 128 characters."); return; }
    setStep("org");
  }

  async function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!orgName.trim()) { setError("Organisation name is required."); return; }
    setLoading(true);
    try {
      const result = await authClient.signUp.email({ name: name.trim(), email: email.trim().toLowerCase(), password });
      if (result.error) { setStep("account"); setError(mapSignUpError(result.error)); return; }
      if (result.data?.token === null) { setError("Check your email to verify your account, then sign in."); return; }

      // Brief pause to let Better Auth finalise the session cookie before
      // the org-creation request. 500ms is conservative but avoids flaky 401s
      // on slower serverless cold starts.
      await new Promise(resolve => setTimeout(resolve, 500));

      const orgRes = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: orgName.trim(), industry: industry.trim() || undefined })
      });

      if (!orgRes.ok) {
        if (orgRes.status === 401) {
          setStep("account");
          setError("Session expired. Please try signing up again.");
          return;
        }
        router.push("/orgs/new");
        return;
      }

      const org = await orgRes.json();
      router.push(`/orgs/${org.id}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "org") {
    return (
      <div>
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-400">Step 2 of 2</p>
          </div>
          <div className="flex gap-1.5 mb-4">
            <div className="h-0.5 w-8 rounded-full bg-gradient-to-r from-orange-500 to-amber-400" />
            <div className="h-0.5 w-8 rounded-full bg-gradient-to-r from-orange-500 to-amber-400" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Set up your organisation</h1>
          <p className="text-sm text-white/40 mt-1">Welcome, {name.split(" ")[0]}. Name your workspace.</p>
        </div>

        <form onSubmit={handleOrgSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="orgName" className="text-[11px] font-medium text-white/40 uppercase tracking-[0.08em]">Organisation name</label>
            <input id="orgName" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} required autoFocus disabled={loading} placeholder="Acme Construction Ltd" className={INPUT_CLS} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="industry" className="text-[11px] font-medium text-white/40 uppercase tracking-[0.08em]">
              Industry <span className="text-white/20 normal-case font-normal">(optional)</span>
            </label>
            <input id="industry" type="text" value={industry} onChange={(e) => setIndustry(e.target.value)} disabled={loading} placeholder="Construction, Logistics, Manufacturing..." className={INPUT_CLS} />
          </div>
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5" role="alert">
              <span className="mt-0.5 text-red-400" aria-hidden="true">⚠</span>
              <span>{error}</span>
            </div>
          )}
          <button type="submit" disabled={loading} className="mt-1 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:shadow-[0_0_28px_rgba(245,158,11,0.5)] hover:from-orange-400 hover:to-amber-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {loading ? "Creating your workspace…" : "Create organisation"}
          </button>
          <button type="button" onClick={() => { setStep("account"); setError(""); }} className="text-sm text-white/30 hover:text-white/60 transition-colors text-center" disabled={loading}>
            Back to account details
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">Step 1 of 2</p>
          <div className="flex gap-1.5">
            <div className="h-0.5 w-8 rounded-full bg-gradient-to-r from-orange-500 to-amber-400" />
            <div className="h-0.5 w-8 rounded-full bg-white/12" />
          </div>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-white">Create your account</h1>
        <p className="text-sm text-white/40 mt-1">Start tracking your organisation&apos;s emissions.</p>
      </div>

      <form onSubmit={handleAccountSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-[11px] font-medium text-white/40 uppercase tracking-[0.08em]">Full name</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" disabled={loading} placeholder="Jane Smith" className={INPUT_CLS} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[11px] font-medium text-white/40 uppercase tracking-[0.08em]">Work email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" disabled={loading} placeholder="you@company.com" className={INPUT_CLS} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-[11px] font-medium text-white/40 uppercase tracking-[0.08em]">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" disabled={loading} placeholder="8+ characters" className={INPUT_CLS} />
        </div>
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5" role="alert">
            <span className="mt-0.5 text-red-400" aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}
        <button type="submit" disabled={loading} className="mt-1 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:shadow-[0_0_28px_rgba(245,158,11,0.5)] hover:from-orange-400 hover:to-amber-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/30">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-amber-400 hover:text-amber-300 transition-colors">Sign in</Link>
      </p>
    </div>
  );
}
