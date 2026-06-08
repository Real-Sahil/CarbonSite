import { NextRequest, NextResponse } from "next/server";
import { getObjectBuffer, isValidStorageKey } from "@/lib/storage";
import { apiError, handleRouteError } from "@/lib/validation/api";

export async function GET(req: NextRequest) {
  try {
    if (process.env.STORAGE_DRIVER !== "local") {
      return apiError("NOT_FOUND", "Local storage route is disabled.", 404);
    }

    const key = req.nextUrl.searchParams.get("key") ?? "";
    if (!isValidStorageKey(key)) {
      return apiError("INVALID_STORAGE_KEY", "Storage key is invalid.", 422);
    }

    const buffer = await getObjectBuffer(key);
    return new NextResponse(new Uint8Array(buffer));
  } catch (err) {
    return handleRouteError(err);
  }
}
