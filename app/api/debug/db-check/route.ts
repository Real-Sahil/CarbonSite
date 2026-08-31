import { NextResponse } from "next/server";

// Diagnostic endpoint to verify DATABASE_URL configuration in Vercel.
// Shows masked URL (password hidden) and connection port so you can
// confirm env vars are set correctly without exposing credentials.
export async function GET() {
  const raw = process.env.DATABASE_URL ?? "";

  let host = "not set";
  let port = "not set";
  let masked = "DATABASE_URL is not set";

  if (raw) {
    try {
      const url = new URL(raw);
      host = url.hostname;
      port = url.port || "5432";
      masked = raw.replace(/:([^@]+)@/, ":[HIDDEN]@");
    } catch {
      masked = "DATABASE_URL is set but could not be parsed as a URL";
    }
  }

  return NextResponse.json({
    host,
    port,
    masked,
    note: "port should be 5432 (direct) — if you see 6543, update Vercel env var and redeploy",
  });
}
