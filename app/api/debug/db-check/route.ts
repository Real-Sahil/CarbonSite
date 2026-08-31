import { NextResponse } from "next/server";

// Diagnostic endpoint to verify DATABASE_URL configuration in Vercel.
// Does NOT attempt database connection — only reads env vars.
export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const directUrl = process.env.DIRECT_URL ?? "";

  let dbHost = "not set";
  let dbPort = "not set";
  let dbMasked = "not set";

  let directHost = "not set";
  let directPort = "not set";
  let directMasked = "not set";

  try {
    if (dbUrl) {
      const url = new URL(dbUrl);
      dbHost = url.hostname;
      dbPort = url.port || "5432";
      dbMasked = dbUrl.replace(/:([^@]+)@/, ":[HIDDEN]@");
    }
  } catch {
    dbMasked = "invalid URL format";
  }

  try {
    if (directUrl) {
      const url = new URL(directUrl);
      directHost = url.hostname;
      directPort = url.port || "5432";
      directMasked = directUrl.replace(/:([^@]+)@/, ":[HIDDEN]@");
    }
  } catch {
    directMasked = "invalid URL format";
  }

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    database_url: {
      host: dbHost,
      port: dbPort,
      masked: dbMasked,
    },
    direct_url: {
      host: directHost,
      port: directPort,
      masked: directMasked,
    },
    note: "If ports show 5432, env vars are correct. If 6543, update Vercel and redeploy. Database connectivity is a separate network issue.",
  });
}
