export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isValidStorageKey, dbReadWithType } from "@/lib/storage";
import { verifyStorageSignature } from "@/lib/storage/signing";
import { apiError, handleRouteError } from "@/lib/validation/api";

// Signed download endpoint for the Postgres-backed storage driver — the
// counterpart of /api/storage/upload. URL produced by presignDownload().
export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key") ?? "";
    const exp = Number(req.nextUrl.searchParams.get("exp"));
    const sig = req.nextUrl.searchParams.get("sig") ?? "";

    if (!isValidStorageKey(key)) {
      return apiError("INVALID_STORAGE_KEY", "Storage key is invalid.", 422);
    }
    if (!verifyStorageSignature(key, exp, sig)) {
      return apiError("INVALID_SIGNATURE", "Download link is invalid or has expired.", 403);
    }

    const object = await dbReadWithType(key);
    if (!object) {
      return apiError("NOT_FOUND", "File not found.", 404);
    }

    const filename = key.split("/").pop() ?? "download";
    return new NextResponse(new Uint8Array(object.bytes), {
      headers: {
        "Content-Type": object.contentType,
        "Content-Length": String(object.bytes.byteLength),
        "Content-Disposition": `inline; filename="${filename.replaceAll('"', "")}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
