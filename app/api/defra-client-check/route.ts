import { randomUUID, timingSafeEqual } from "node:crypto";
import { DefraAuthError, defraFetch, getDefraAccessToken } from "@/lib/defra-dwt/client";

// Temporary probe for the DEFRA token client. Delete before any merge to main.
// Returns booleans and HTTP status only, never a token. The query-string token exists for a
// phone browser and can land in request logs, so the probe token is disposable.
export const dynamic = "force-dynamic";

function guardMatches(given: string | null): boolean {
  const expected = process.env.DEFRA_PROBE_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const given = request.headers.get("x-probe-token") ?? new URL(request.url).searchParams.get("token");
  if (!guardMatches(given)) return new Response("Not found", { status: 404 });

  try {
    const first = await getDefraAccessToken();
    const second = await getDefraAccessToken();
    const forced = await getDefraAccessToken(true);
    // Read-only GET on a random id. 404: bearer accepted. 401: refused. 403: ambiguous (gateway).
    const res = await defraFetch(`/movements/${randomUUID()}`);
    return Response.json({
      tokenLength: first.length,
      cacheReused: first === second,
      forcedRefreshNewToken: forced !== first,
      movementsGetStatus: res.status,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.name : "unknown",
        httpStatus: err instanceof DefraAuthError ? err.status : null,
      },
      { status: 502 },
    );
  }
}
