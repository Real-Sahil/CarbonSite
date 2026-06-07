import { NextRequest, NextResponse } from "next/server";
import { putObject } from "@/lib/storage";
import { apiError, handleRouteError } from "@/lib/validation/api";

export async function PUT(req: NextRequest) {
  try {
    if (process.env.STORAGE_DRIVER !== "local") {
      return apiError("NOT_FOUND", "Local storage route is disabled.", 404);
    }

    const key = req.nextUrl.searchParams.get("key") ?? "";
    const contentType =
      req.nextUrl.searchParams.get("contentType") ??
      req.headers.get("content-type") ??
      "application/octet-stream";

    if (!isSafeLocalStorageKey(key)) {
      return apiError("INVALID_STORAGE_KEY", "Storage key is invalid.", 422);
    }

    await putObject(key, Buffer.from(await req.arrayBuffer()), contentType);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

function isSafeLocalStorageKey(key: string) {
  return key.startsWith("org/") && !key.includes("..") && !key.startsWith("/");
}
