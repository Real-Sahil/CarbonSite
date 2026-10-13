import { z } from "zod";

// Server-only. OAuth bearer token for Defra's Receipt of Waste API, using the request shape in the published
// authentication guide (docs/api-authentication-guide.md in DEFRA/waste-tracking-service, OGL v3.0). Nothing calls
// it from a route yet.
// shortcut: test hosts only, switch to the production URLs once production credentials are issued.
const TOKEN_URL = "https://waste-movement-external-api-8ec5c.auth.eu-west-2.amazoncognito.com/oauth2/token";
const API_BASE = "https://waste-tracking.integration.api.defra.gov.uk";

// The token lifetime is not documented: refresh a minute early, and assume five minutes when no expires_in comes back.
const REFRESH_MARGIN_MS = 60_000;
const DEFAULT_LIFETIME_S = 300;

const tokenReply = z.object({ access_token: z.string().min(1), expires_in: z.number().positive().optional() });

// Status only: a refused request can echo the credentials, so its body is never copied into the error.
export class DefraAuthError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Defra token request failed with HTTP ${status}`);
    this.name = "DefraAuthError";
    this.status = status;
  }
}

let cached: { token: string; expiresAt: number } | null = null;
let inFlight: Promise<string> | null = null;

async function requestToken(id: string, secret: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new DefraAuthError(res.status);
  const parsed = tokenReply.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new DefraAuthError(res.status);
  const lifetimeMs = (parsed.data.expires_in ?? DEFAULT_LIFETIME_S) * 1000;
  cached = { token: parsed.data.access_token, expiresAt: Date.now() + lifetimeMs - REFRESH_MARGIN_MS };
  return parsed.data.access_token;
}

// Concurrent callers share one request. force replaces the cached token, used after a 401 on a call that sent it.
export async function getDefraAccessToken(force = false): Promise<string> {
  if (!force && cached && Date.now() < cached.expiresAt) return cached.token;
  const id = process.env.DEFRA_DWT_CLIENT_ID?.trim();
  const secret = process.env.DEFRA_DWT_CLIENT_SECRET?.trim();
  if (!id || !secret) throw new Error("DEFRA_DWT_CLIENT_ID and DEFRA_DWT_CLIENT_SECRET must be set");
  inFlight ??= requestToken(id, secret).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

// Adds the bearer token. A 401 means the token was refused: it is replaced once and the call is made again.
// shortcut: body must be a string or absent (the retry resends it), upgrade before sending a stream.
export async function defraFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = async (force: boolean) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${await getDefraAccessToken(force)}`);
    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(15000),
      cache: "no-store",
    });
  };
  const res = await send(false);
  return res.status === 401 ? send(true) : res;
}
