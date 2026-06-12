"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface CommentActionsProps {
  orgId: string;
  submissionId: string;
  comments: { id: string; body: string; createdAt: string; authorName: string }[];
}

export function SubmissionCommentActions({
  orgId,
  submissionId,
}: CommentActionsProps) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/field-submissions/${submissionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to post comment.");
      } else {
        window.location.reload();
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment for the field worker or review team…"
        rows={3}
        className="resize-none text-sm"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading || !body.trim()} size="sm" className="gap-1.5">
          <Send aria-hidden="true" className="h-3.5 w-3.5" />
          {loading ? "Posting…" : "Post comment"}
        </Button>
        {error && <p className="text-sm text-red-600 tracking-[-0.42px]">{error}</p>}
      </div>
    </form>
  );
}
