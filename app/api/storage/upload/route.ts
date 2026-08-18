export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isValidStorageKey, dbWrite } from "@/lib/storage";
import { verifyStorageSignature } from "@/lib/storage/signing";
import {
  isAllowedEvidenceMimeType,
  isAllowedEvidenceSize,
  normalizeMimeType,
} from "@/lib/evidence/upload-policy";
import { apiError, handleRouteError } from "@/lib/validation/api";

// Signed upload endpoint for the Postgres-backed storage driver. The URL is
// produced by presignUpload() and carries an HMAC + expiry — the client
// (web or mobile) PUTs raw bytes without any session, exactly like an
// S3 presigned URL. Photos from the mobile app are ~0.3–1.5 MB; note the
// platform request-body ceiling on serverless (~4.5 MB) sits below the
// 25 MB evidence policy limit.
export async function PUT(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key") ?? "";
    const exp = Number(req.nextUrl.searchParams.get("exp"));
    const sig = req.nextUrl.searchParams.get("sig") ?? "";

    if (!isValidStorageKey(key)) {
      return apiError("INVALID_STORAGE_KEY", "Storage key is invalid.", 422);
    }
    if (!verifyStorageSignature(key, exp, sig)) {
      return apiError("INVALID_SIGNATURE", "Upload link is invalid or has expired.", 403);
    }

    const contentType = normalizeMimeType(
      req.nextUrl.searchParams.get("contentType") ??
        req.headers.get("content-type") ??
        "application/octet-stream",
    );
    if (!isAllowedEvidenceMimeType(contentType)) {
      return apiError("UNSUPPORTED_FILE_TYPE", "Evidence file type is not allowed.", 415);
    }

    const body = Buffer.from(await req.arrayBuffer());
    if (body.byteLength === 0) {
      return apiError("EMPTY_BODY", "Upload body is empty.", 400);
    }
    if (!isAllowedEvidenceSize(body.byteLength)) {
      return apiError("FILE_TOO_LARGE", "Evidence file size exceeds the upload limit.", 413);
    }

    await dbWrite(key, body, contentType);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
