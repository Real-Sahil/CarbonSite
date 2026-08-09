"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { ArrowRight, Building2 } from "lucide-react";

type Step = "account" | "org";

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("account");

  // Step 1 — account
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 — org
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAccountSubmit(e: React.FormEvent) {
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

    setStep("org");
  }

  async function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!orgName.trim()) {
      setError("Organisation name is required.");
      return;
    }

    setLoading(true);
    try {
      // Create account
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (result.error) {
        setStep("account");
        setError(result.error.message ?? "Could not create account. Please try again.");
        return;
      }

      // Email verification flow — account created but not yet active
      if (result.data?.token === null) {
        setError("Check your email to verify your account, then sign in.");
        return;
      }

      // Create org immediately after signup so the user lands in a working dashboard
      const orgRes = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgName.trim(),
          industry: industry.trim() || undefined,
        }),
      });

      if (!orgRes.ok) {
        // Account created but org failed — still redirect to /orgs/new so they can retry
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

  const inputCls =
    "w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15 disabled:opacity-50 transition-colors";

  if (step === "org") {
    return (
      <div>
        <div className="mb-7">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
              <Building2 className="h-4 w-4 text-[#4F46E5]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4F46E5]">Step 2 of 2</p>
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Set up your organisation</h1>
          <p className="text-sm text-zinc-500 mt-1.5">
            Welcome, {name.split(" ")[0]}. Name your workspace.
          </p>
        </div>

        <form onSubmit={handleOrgSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="orgName" className="text-xs font-medium text-zinc-700 uppercase tracking-wide">
              Organisation name
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              autoFocus
              disabled={loading}
              placeholder="Acme Construction Ltd"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="industry" className="text-xs font-medium text-zinc-700 uppercase tracking-wide">
              Industry <span className="text-zinc-400 normal-case font-normal">(optional)</span>
            </label>
            <input
              id="industry"
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              disabled={loading}
              placeholder="Construction, Logistics, Manufacturing..."
              className={inputCls}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-lg bg-[#4F46E5] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#4338CA] active:scale-[0.98] disabled:opacity-60 transition-all"
          >
            {loading ? "Creating your workspace..." : "Create organisation"}
          </button>

          <button
            type="button"
            onClick={() => { setStep("account"); setError(""); }}
            className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors text-center"
            disabled={loading}
          >
            Back to account details
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Step 1 of 2</p>
          <div className="flex gap-1">
            <div className="h-1 w-8 rounded-full bg-[#4F46E5]" />
            <div className="h-1 w-8 rounded-full bg-zinc-200" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Create your account</h1>
        <p className="text-sm text-zinc-500 mt-1.5">Start tracking your organisation&apos;s emissions.</p>
      </div>

      <form onSubmit={handleAccountSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-xs font-medium text-zinc-700 uppercase tracking-wide">
            Full name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            disabled={loading}
            placeholder="Jane Smith"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-zinc-700 uppercase tracking-wide">
            Work email
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
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-zinc-700 uppercase tracking-wide">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            disabled={loading}
            placeholder="8+ characters"
            className={inputCls}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-lg bg-[#4F46E5] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#4338CA] active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-[#4F46E5] hover:text-[#4F46E5] transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
