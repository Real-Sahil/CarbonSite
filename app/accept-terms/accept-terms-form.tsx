"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TERMS_VERSION } from "@/lib/legal/terms";
import { acceptTerms } from "./actions";

export function AcceptTermsForm() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);
    const result = await acceptTerms({ termsVersion: TERMS_VERSION }).catch(() => ({ ok: false as const, error: "" }));
    if (!result.ok) {
      setPending(false);
      setError("We could not record your acceptance. Please try again.");
      return;
    }
    router.replace("/");
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 text-sm text-[#131d29]">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} disabled={pending} className="mt-1 h-4 w-4" />
        <span>
          I accept the <Link href="/terms" target="_blank" className="underline underline-offset-2">Terms of Service</Link> and the{" "}
          <Link href="/privacy" target="_blank" className="underline underline-offset-2">Privacy Policy</Link>.
        </span>
      </label>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <Button
        type="button"
        onClick={accept}
        disabled={!accepted || pending}
      >
        {pending ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
