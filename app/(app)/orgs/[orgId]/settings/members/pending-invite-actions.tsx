"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PendingInviteActionsProps {
  orgId: string;
  inviteId: string;
  email: string;
  role: string;
  /** Invite token — lets the admin copy the accept link directly, which is
   *  the only delivery path when transactional email is not configured. */
  token?: string;
}

export function PendingInviteActions({
  orgId,
  inviteId,
  email,
  role,
  token,
}: PendingInviteActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resendState, setResendState] = useState<"idle" | "sent" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyLink() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — copy the URL manually.");
    }
  }

  function revoke() {
    if (!window.confirm(`Revoke invite to ${email}? They will no longer be able to accept it.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/invite-links/${inviteId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Failed to revoke invite.");
        return;
      }
      router.refresh();
    });
  }

  function resend() {
    setError(null);
    setResendState("idle");
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Failed to resend invite.");
        setResendState("error");
        return;
      }
      setResendState("sent");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {resendState === "sent" && (
        <p className="text-xs text-[#0F172A]">Resent</p>
      )}
      {token && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-[#475569] hover:text-[#0F172A] hover:bg-[#EEF2FF]"
          title="Copy invite link"
          disabled={isPending}
          onClick={copyLink}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-[#0F172A]" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-[#475569] hover:text-[#0F172A] hover:bg-[#EEF2FF]"
        title="Resend invite email"
        disabled={isPending}
        onClick={resend}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
        title="Revoke invite"
        disabled={isPending}
        onClick={revoke}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
