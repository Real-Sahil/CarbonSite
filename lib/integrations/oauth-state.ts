// Signed OAuth `state` for the Xero, QuickBooks and Sage connect flows. It names the org, the admin who
// started the flow and that admin's session. A callback is accepted only from that same session while the
// admin is still an admin, so nobody can attach their own accounting tokens to another org (login CSRF), and
// a state issued in one browser session cannot be finished in another.
import { createHmac, timingSafeEqual } from "crypto";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";

const MAX_AGE_MS = 15 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function sign(body: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET must be set — OAuth state signing requires it.");
  return createHmac("sha256", secret).update(`oauth-state:${body}`).digest("base64url");
}

// The session id is the session row's id, not its bearer token, so it can sit in the state.
export function signOAuthState(orgId: string, userId: string, sessionId: string): string {
  const claims = { o: orgId, u: userId, s: sessionId, t: Date.now() };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${sign(body)}`;
}

// The org, admin and session a state was issued to, or null when it is forged, stale or malformed.
export function readOAuthState(
  state: string | null,
): { orgId: string; userId: string; sessionId: string } | null {
  const parts = state?.split(".") ?? [];
  if (parts.length !== 2) return null;
  const [body, signature] = parts as [string, string];
  const expected = Buffer.from(sign(body));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  let claims: { o?: unknown; u?: unknown; s?: unknown; t?: unknown };
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
  const { o, u, s, t } = claims;
  // A state signed before sessions were bound has no `s`: refuse it, so the old format cannot be replayed.
  if (typeof o !== "string" || typeof u !== "string" || typeof s !== "string" || typeof t !== "number") return null;
  const age = Date.now() - t;
  if (age > MAX_AGE_MS || age < -CLOCK_SKEW_MS) return null;
  return { orgId: o, userId: u, sessionId: s };
}

// The org a callback may connect, or null. The state must be valid, and the signed-in session must be the one
// that started the flow, still belonging to an admin of that org. Checked before the code is exchanged for tokens.
export async function oauthCallbackOrgId(state: string | null): Promise<string | null> {
  const issued = readOAuthState(state);
  if (!issued) return null;
  try {
    const { session } = await requireOrgMember(issued.orgId, ...ROLE_GROUPS.admins);
    const sameFlow = session.user.id === issued.userId && session.session.id === issued.sessionId;
    return sameFlow ? issued.orgId : null;
  } catch {
    // Signed out, no longer an admin, or a lookup failed: refuse; the callback redirects with invalid_state
    return null;
  }
}
