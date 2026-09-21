import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { presignDownload } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Public endpoint — no auth required.
// Serves the org's white-label logo for embedding in email templates.
// This URL is stable and never expires, unlike presigned R2 URLs (1-hour TTL).
// Email clients that render images on open will always get a fresh response.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const branding = await prisma.tenantBranding.findUnique({
    where: { organizationId: orgId },
    select: { reportHeaderLogoKey: true, logoStorageKey: true },
  });

  const key = branding?.reportHeaderLogoKey ?? branding?.logoStorageKey;
  if (!key) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const signedUrl = await presignDownload(key);
    const upstream = await fetch(signedUrl);
    if (!upstream.ok) return new NextResponse(null, { status: 404 });

    const body = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") ?? "image/png";

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        // 1-hour browser/CDN cache; email clients will re-fetch if expired.
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
