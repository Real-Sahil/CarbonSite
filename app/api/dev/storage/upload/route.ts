import { NextRequest, NextResponse } from "next/server";
import { isValidStorageKey, putObject } from "@/lib/storage";
import {
  isAllowedEvidenceMimeType,
  isAllowedEvidenceSize,
  normalizeMimeType,
} from "@/lib/evidence/upload-policy";
import { apiError, handleRouteError } from "@/lib/validation/api";

export async function PUT(req: NextRequest) {
  try {
    if (process.env.STORAGE_DRIVER !== "local") {
      return apiError("NOT_FOUND", "Local storage route is disabled.", 404);
    }

    const key = req.nextUrl.searchParams.get("key") ?? "";
    const contentType = normalizeMimeType(
      req.nextUrl.searchParams.get("contentType") ??
        req.headers.get("content-type") ??
        "application/octet-stream",
    );

    if (!isValidStorageKey(key)) {
      return apiError("INVALID_STORAGE_KEY", "Storage key is invalid.", 422);
    }
    if (!isAllowedEvidenceMimeType(contentType)) {
      return apiError("UNSUPPORTED_FILE_TYPE", "Evidence file type is not allowed.", 415);
    }

    const body = Buffer.from(await req.arrayBuffer());
    if (!isAllowedEvidenceSize(body.byteLength)) {
      return apiError("FILE_TOO_LARGE", "Evidence file size exceeds the upload limit.", 413);
    }

    await putObject(key, body, contentType);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
