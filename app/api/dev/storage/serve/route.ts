export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getObjectBuffer, isValidStorageKey } from "@/lib/storage";
import { verifyStorageSignature } from "@/lib/storage/signing";
import { apiError, handleRouteError } from "@/lib/validation/api";

export async function GET(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production" || process.env.STORAGE_DRIVER !== "local") {
      return apiError("NOT_FOUND", "Local storage route is disabled.", 404);
    }

    const key = req.nextUrl.searchParams.get("key") ?? "";
    const exp = Number(req.nextUrl.searchParams.get("exp"));
    const sig = req.nextUrl.searchParams.get("sig") ?? "";

    if (!isValidStorageKey(key)) {
      return apiError("INVALID_STORAGE_KEY", "Storage key is invalid.", 422);
    }
    if (!verifyStorageSignature(key, exp, sig)) {
      return apiError("INVALID_SIGNATURE", "Download link is invalid or has expired.", 403);
    }

    const buffer = await getObjectBuffer(key);
    const filename = key.split("/").pop() ?? "download";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `inline; filename="${filename.replaceAll('"', "")}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
