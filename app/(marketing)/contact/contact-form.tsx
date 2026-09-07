"use client";

import { useState } from "react";
import { ArrowUpRight, Loader2, CheckCircle } from "lucide-react";

type FormState = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setError(null);

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      company: (form.elements.namedItem("company") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError((json as { message?: string }).message ?? "Something went wrong. Please try again.");
        setState("error");
        return;
      }

      setState("success");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <CheckCircle className="h-10 w-10 text-cyan-500" />
        <h3 className="text-lg font-semibold text-[#0F172A] tracking-tight">Request received</h3>
        <p className="text-sm text-[#64748B] max-w-[40ch] leading-relaxed">
          We'll be in touch shortly. Check your inbox for a confirmation.
        </p>
      </div>
    );
  }

  const isSubmitting = state === "submitting";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-[#374151] mb-1.5 tracking-wide">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Jane Smith"
            disabled={isSubmitting}
            className="w-full h-10 rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-[#374151] mb-1.5 tracking-wide">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="jane@company.com"
            disabled={isSubmitting}
            className="w-full h-10 rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
        </div>
      </div>

      <div>
        <label htmlFor="company" className="block text-xs font-medium text-[#374151] mb-1.5 tracking-wide">
          Company
        </label>
        <input
          id="company"
          name="company"
          type="text"
          required
          autoComplete="organization"
          placeholder="Acme Construction Ltd"
          disabled={isSubmitting}
          className="w-full h-10 rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-xs font-medium text-[#374151] mb-1.5 tracking-wide">
          Tell us about your pilot
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          minLength={10}
          placeholder="Briefly describe your project, reporting period, and what you want to measure."
          disabled={isSubmitting}
          className="w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed resize-y transition-colors leading-relaxed"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2.5">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1e293b] disabled:opacity-60 disabled:cursor-not-allowed transition-colors active:scale-[0.97]"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            Send pilot request
            <ArrowUpRight className="h-3.5 w-3.5" />
          </>
        )}
      </button>
    </form>
  );
}
