"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, Copy, Check } from "lucide-react";

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
  const [links, setLinks] = useState<ActiveInviteLink[]>(initialLinks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function buildInviteUrl(token: string): string {
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL ?? "";
    return `${base}/invite/${token}`;
  }

  async function handleGenerate() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/invite-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "field_worker" }),
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

  async function handleCopy(token: string, id: string) {
    try {
      await navigator.clipboard.writeText(buildInviteUrl(token));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback: select the input
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
          <Link className="h-4 w-4 mr-2" />
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
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Active invite links
          </p>
          {links.map((link) => {
            const url = buildInviteUrl(link.token);
            const isCopied = copiedId === link.id;
            const expiresAt = new Date(link.expiresAt);
            return (
              <div
                key={link.id}
                className="flex items-center gap-2 p-2.5 rounded-md border border-slate-200 bg-slate-50"
              >
                <Input
                  readOnly
                  value={url}
                  className="text-xs h-7 bg-white text-slate-600 font-mono border-slate-200"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleCopy(link.token, link.id)}
                  title="Copy link"
                >
                  {isCopied ? (
                    <Check className="h-3.5 w-3.5 text-green-700" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
                  Expires{" "}
                  {expiresAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
