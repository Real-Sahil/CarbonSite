"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, Copy, Check, Trash2, RefreshCw, Smartphone } from "lucide-react";

interface ActiveInviteLink {
  id: string;
  token: string;
  expiresAt: Date | string;
  role: string;
}

interface InviteLinkGeneratorProps {
  orgId: string;
  initialLinks: ActiveInviteLink[];
}

export function InviteLinkGenerator({
  orgId,
  initialLinks,
}: InviteLinkGeneratorProps) {
  const router = useRouter();
  const [links, setLinks] = useState<ActiveInviteLink[]>(initialLinks);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedMobileId, setCopiedMobileId] = useState<string | null>(null);

  function getOrigin(): string {
    return typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "");
  }

  function buildInviteUrl(token: string): string {
    return `${getOrigin()}/invite/${token}`;
  }

  /** Mobile deep-link: carbonsite://app/invite/{token}?server={origin}
   *  GoRouter maps host=app → path /invite/{token}; ?server tells the app
   *  which API endpoint to call after the user submits the form. */
  function buildMobileInviteUrl(token: string): string {
    const origin = getOrigin();
    return `carbonsite://app/invite/${token}?server=${encodeURIComponent(origin)}`;
  }

  async function handleGenerate() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/invite-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "field_worker", expiresInDays: 30 }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to generate invite link.");
        return;
      }

      const link = await res.json();
      setLinks((prev) => [link, ...prev]);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(linkId: string) {
    if (!window.confirm("Revoke this invite link? Anyone who has it will no longer be able to use it.")) return;
    setRevoking(linkId);
    setError("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/invite-links/${linkId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to revoke invite link.");
        return;
      }
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setRevoking(null);
    }
  }

  async function handleCopy(token: string, id: string) {
    try {
      await navigator.clipboard.writeText(buildInviteUrl(token));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore — clipboard blocked
    }
  }

  async function handleCopyMobile(token: string, id: string) {
    try {
      await navigator.clipboard.writeText(buildMobileInviteUrl(token));
      setCopiedMobileId(id);
      setTimeout(() => setCopiedMobileId(null), 2000);
    } catch {
      // ignore — clipboard blocked
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          onClick={handleGenerate}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Link className="h-4 w-4 mr-2" />
          )}
          {loading ? "Generating..." : "Generate field worker link"}
        </Button>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      {links.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-[#333333] uppercase tracking-wide">
            Active invite links
          </p>
          {links.map((link) => {
            const url = buildInviteUrl(link.token);
            const isCopied = copiedId === link.id;
            const isMobileCopied = copiedMobileId === link.id;
            const isRevoking = revoking === link.id;
            const expiresAt = new Date(link.expiresAt);
            return (
              <div
                key={link.id}
                className="flex flex-col gap-1.5 p-[9px] rounded-[7px] border border-[#e5e7eb] bg-[#e1f4df]"
              >
                {/* Web link row */}
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={url}
                    className="text-xs h-7 bg-[#fffefc] text-[#222222] font-mono border-[#e5e7eb]"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleCopy(link.token, link.id)}
                    title="Copy web link"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-[#0f3e17]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <span className="text-xs text-[#333333] shrink-0 whitespace-nowrap tracking-[-0.36px]">
                    Expires{" "}
                    {expiresAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRevoke(link.id)}
                    disabled={isRevoking}
                    title="Revoke invite link"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {/* Mobile app deep-link row */}
                <div className="flex items-center gap-2">
                  <Smartphone className="h-3.5 w-3.5 text-[#166534] shrink-0" />
                  <span className="text-xs text-[#166534] font-medium shrink-0">
                    Mobile app link
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs px-2 text-[#166534] hover:bg-white/60 gap-1"
                    onClick={() => handleCopyMobile(link.token, link.id)}
                  >
                    {isMobileCopied ? (
                      <><Check className="h-3 w-3" /> Copied</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copy for CarbonSite app</>
                    )}
                  </Button>
                  <span className="text-xs text-[#555] ml-auto shrink-0">
                    opens in Flutter app
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
