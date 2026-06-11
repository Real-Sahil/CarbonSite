"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

type SubmissionComment = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
};

export function SubmissionCommentActions({
  orgId,
  submissionId,
  comments,
}: {
  orgId: string;
  submissionId: string;
  comments: SubmissionComment[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "field_submission",
          targetId: submissionId,
          body: trimmed,
        }),
      });
      if (!res.ok) {
        const responseBody = await res.json().catch(() => null);
        setError(responseBody?.message ?? "Could not add comment");
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="flex min-w-56 flex-col gap-2">
      {comments.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No comments</p>
      ) : (
        <div className="max-h-28 space-y-2 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-md bg-slate-50 p-2">
              <p className="text-xs text-slate-700">{comment.body}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {comment.authorName} - {comment.createdAt}
              </p>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-1.5">
        <textarea
          value={body}
          disabled={isPending}
          maxLength={2000}
          placeholder="Add reviewer comment"
          onChange={(event) => setBody(event.target.value)}
          className="min-h-16 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={isPending || body.trim().length === 0}
          className="self-start"
        >
          <MessageSquare className="h-4 w-4" />
          Add comment
        </Button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
