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
        <CheckCircle className="h-10 w-10 text-mk-accent" />
        <h3 className="text-lg font-semibold text-mk-text tracking-tight">Request received</h3>
        <p className="text-sm text-mk-text-3 max-w-[40ch] leading-relaxed">
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
          <label htmlFor="name" className="block text-[13px] font-medium text-mk-text-2 mb-1.5 tracking-wide">
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
            className="w-full h-11 rounded-[10px] border border-mk-line bg-mk-surface px-3 text-[15px] text-mk-text placeholder-mk-text-3 focus:outline-none focus:ring-2 focus:ring-mk-accent/25 focus:border-mk-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-[13px] font-medium text-mk-text-2 mb-1.5 tracking-wide">
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
            className="w-full h-11 rounded-[10px] border border-mk-line bg-mk-surface px-3 text-[15px] text-mk-text placeholder-mk-text-3 focus:outline-none focus:ring-2 focus:ring-mk-accent/25 focus:border-mk-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
        </div>
      </div>

      <div>
        <label htmlFor="company" className="block text-[13px] font-medium text-mk-text-2 mb-1.5 tracking-wide">
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
          className="w-full h-11 rounded-[10px] border border-mk-line bg-mk-surface px-3 text-[15px] text-mk-text placeholder-mk-text-3 focus:outline-none focus:ring-2 focus:ring-mk-accent/25 focus:border-mk-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-[13px] font-medium text-mk-text-2 mb-1.5 tracking-wide">
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
          className="w-full rounded-[10px] border border-mk-line bg-mk-surface px-3 py-2.5 text-[15px] text-mk-text placeholder-mk-text-3 focus:outline-none focus:ring-2 focus:ring-mk-accent/25 focus:border-mk-accent disabled:opacity-50 disabled:cursor-not-allowed resize-y transition-colors leading-relaxed"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2.5">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-[10px] bg-mk-accent text-white text-[15px] font-medium hover:bg-mk-accent-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors active:scale-[0.97]"
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
