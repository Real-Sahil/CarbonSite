export const dynamic = "force-dynamic";

// Public endpoint: returns the branding config for a subdomain.
// Used by custom domain verification pages and future client-side theming.
// No auth required — only non-sensitive fields are returned.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ subdomain: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { subdomain } = await params;

  const branding = await prisma.tenantBranding.findUnique({
    where: { subdomain },
    select: {
      subdomain: true,
      customDomain: true,
      primaryHex: true,
      accentHex: true,
      fontFamily: true,
      emailFromName: true,
      organization: { select: { name: true } },
    },
  });

  if (!branding) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    subdomain: branding.subdomain,
    customDomain: branding.customDomain,
    primaryHex: branding.primaryHex,
    accentHex: branding.accentHex,
    fontFamily: branding.fontFamily,
    emailFromName: branding.emailFromName,
    orgName: branding.organization.name,
  });
}
