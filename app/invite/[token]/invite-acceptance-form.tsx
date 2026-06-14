"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, Copy, Smartphone } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InviteState = "active" | "used" | "expired";

export function InviteAcceptanceForm({
  token,
  orgId,
  orgName,
  invitedEmail,
  role,
  expiresAt,
  state,
}: {
  token: string;
  orgId: string;
  orgName: string;
  invitedEmail: string | null;
  role: string;
  expiresAt: string;
  state: InviteState;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(invitedEmail ?? "");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isTeamInvite = role !== "field_worker";
  const expires = new Date(expiresAt);

  async function copyToken() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (state !== "active") return;
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (isTeamInvite && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (isTeamInvite) {
        await ensureSignedIn({
          name: name.trim(),
          email: normalizedEmail,
          password,
        });
      }

      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          email: normalizedEmail || undefined,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Could not accept invite.");
        return;
      }
      router.push(`/orgs/${orgId}/dashboard`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite.");
    } finally {
      setLoading(false);
    }
  }

  if (state !== "active") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleAlert className="h-4 w-4 text-red-600" />
            Invite unavailable
          </CardTitle>
          <CardDescription>
            This invite has {state === "used" ? "already been used" : "expired"}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isTeamInvite) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-4 w-4 text-green-700" />
              Open in the mobile app
            </CardTitle>
            <Badge variant="outline">field worker</Badge>
          </div>
          <CardDescription>
            Field worker invites create a mobile profile, device PIN, and assigned
            project access. Use this token in the CarbonSite mobile app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-token">Invite token</Label>
            <div className="flex gap-2">
              <Input
                id="invite-token"
                value={token}
                readOnly
                className="min-w-0 flex-1 font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={copyToken}
              >
                <Copy className="mr-2 h-4 w-4" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
            Open CarbonSite mobile, paste the invite link or token, enter the
            worker name, then set the device PIN.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Accept invite</CardTitle>
          <Badge variant="outline">{role.replaceAll("_", " ")}</Badge>
        </div>
        <CardDescription>
          Expires{" "}
          {expires.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-name">Full name</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              disabled={loading}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={loading || Boolean(invitedEmail)}
              required={isTeamInvite}
            />
          </div>
          {isTeamInvite && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-password">Password</Label>
              <Input
                id="invite-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                disabled={loading}
                required
              />
            </div>
          )}
          {error && (
            <p className="flex items-start gap-2 text-sm text-red-600" role="alert">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Accepting..." : `Join ${orgName}`}
          </Button>
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
            Team invites use your CarbonSite account before joining the organisation.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

async function ensureSignedIn({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  const signUpResult = await authClient.signUp.email({ name, email, password });
  if (!signUpResult.error) return;

  const signInResult = await authClient.signIn.email({ email, password });
  if (!signInResult.error) return;

  throw new Error(
    signInResult.error.message ??
      signUpResult.error.message ??
      "Could not create or sign in to your CarbonSite account.",
  );
}
