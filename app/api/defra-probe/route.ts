import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Temporary probe for the Defra test token endpoint. Preview branch only; delete after use.
// Returns status and error codes only, never the token or the secret.
export const dynamic = "force-dynamic";

const TOKEN_URL = "https://waste-movement-external-api-8ec5c.auth.eu-west-2.amazoncognito.com/oauth2/token";

function guardOk(header: string | null): boolean {
  const expected = process.env.DEFRA_PROBE_TOKEN;
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  // Query fallback so the probe can be opened from a phone browser (no custom headers there).
  const token = req.headers.get("x-probe-token") ?? new URL(req.url).searchParams.get("token");
  if (!guardOk(token)) return new NextResponse(null, { status: 404 });
  const id = process.env.DEFRA_DWT_CLIENT_ID?.trim();
  const secret = process.env.DEFRA_DWT_CLIENT_SECRET?.trim();
  if (!id || !secret) return NextResponse.json({ error: "defra_env_missing" });
  const basic = `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
  const variants: Record<string, { auth?: string; body: Record<string, string> }> = {
    basic_only: { auth: basic, body: { grant_type: "client_credentials" } },
    body_only: { body: { grant_type: "client_credentials", client_id: id, client_secret: secret } },
    both_like_client_ts: { auth: basic, body: { grant_type: "client_credentials", client_id: id, client_secret: secret } },
  };
  const results: Record<string, unknown> = {};
  for (const [name, v] of Object.entries(variants)) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
      if (v.auth) headers.Authorization = v.auth;
      const res = await fetch(TOKEN_URL, { method: "POST", headers, body: new URLSearchParams(v.body), signal: AbortSignal.timeout(10000) });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      results[name] = {
        http: res.status,
        access_token_present: typeof json.access_token === "string" && json.access_token.length > 0,
        token_type: json.token_type ?? null,
        expires_in: json.expires_in ?? null,
        error: json.error ?? null,
      };
    } catch (e) {
      results[name] = { network_error: e instanceof Error ? e.name : "unknown" };
    }
  }
  return NextResponse.json(results);
}
