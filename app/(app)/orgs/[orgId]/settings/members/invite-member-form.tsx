"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "reviewer", label: "Reviewer" },
  { value: "viewer", label: "Viewer" },
  { value: "auditor", label: "Auditor" },
  { value: "field_worker", label: "Field Worker" },
] as const;

interface InviteMemberFormProps {
  orgId: string;
  onSuccess?: () => void;
}

export function InviteMemberForm({ orgId, onSuccess }: InviteMemberFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to invite member. Please try again.");
        return;
      }

      const data = await res.json().catch(() => null);
      setSuccess(
        data?.action === "member_added"
          ? data.emailDelivery === "email_failed"
            ? `${email.trim()} already has an account and was added. Notification email needs follow-up.`
            : `${email.trim()} already has an account and was added to this organisation.`
          : role === "field_worker"
            ? `Mobile field worker invite sent to ${email.trim()}. Assign their project after they accept.`
            : `Invite sent to ${email.trim()}.`,
      );
      setEmail("");
      setRole("viewer");
      router.refresh();
      onSuccess?.();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <Select value={role} onValueChange={setRole} disabled={loading}>
            <SelectTrigger id="invite-role" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={loading} className="self-end">
          {loading ? "Sending..." : "Send invite"}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-700" role="status">
          {success}
        </p>
      )}
    </form>
  );
}
