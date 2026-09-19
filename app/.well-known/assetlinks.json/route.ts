import { NextResponse } from "next/server";

// Android App Links verification. AndroidManifest.xml declares
// android:autoVerify="true" for https://metricora.co.uk/invite and
// https://www.metricora.co.uk/invite, which makes Android fetch this file at
// install time. Without it verification fails silently and every invite link
// opens in the browser instead of the app, so a field worker has to tap through
// a web page to get to the install they were sent.
//
// The fingerprint belongs to the key the shipped APK is signed with. Set
// ANDROID_CERT_SHA256_FINGERPRINT to the colon-separated SHA-256 of that
// certificate. When the app is distributed through Play, Play re-signs it, so
// this must be the App signing key fingerprint from Play Console (Setup > App
// integrity), not the upload key. Both can be listed, comma separated, which is
// what you want while sideloading a locally signed APK and testing a Play build
// at the same time.
//
// Read it with:
//   keytool -list -v -keystore <keystore> -alias <alias> | grep SHA256

const PACKAGE_NAME = "app.metricora.metricora_mobile";

export function GET() {
  const raw = process.env.ANDROID_CERT_SHA256_FINGERPRINT?.trim();

  // Serving a file with no fingerprints would still be a verification failure,
  // but a cached one. A 404 lets Android retry once the variable is set.
  if (!raw) {
    return NextResponse.json(
      {
        error:
          "ANDROID_CERT_SHA256_FINGERPRINT is not set, so Android App Links cannot be verified.",
      },
      { status: 404 },
    );
  }

  const fingerprints = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: PACKAGE_NAME,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        "Content-Type": "application/json",
        // Android and Google's verifier both cache this. Keep it short enough
        // that rotating a signing key does not lock users out for a day.
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
