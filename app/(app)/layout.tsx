import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import React from "react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Apply white-label branding when accessed via a tenant subdomain.
  const subdomain = (await headers()).get("x-subdomain");
  let brandingStyle: React.CSSProperties | undefined;

  if (subdomain) {
    const branding = await prisma.tenantBranding.findUnique({
      where: { subdomain },
      select: { primaryHex: true, accentHex: true, fontFamily: true },
    });

    if (branding) {
      brandingStyle = {
        "--brand-primary": branding.primaryHex,
        "--brand-accent": branding.accentHex,
        "--brand-font": branding.fontFamily,
      } as React.CSSProperties;
    }
  }

  if (brandingStyle) {
    return <div style={brandingStyle}>{children}</div>;
  }

  return <>{children}</>;
}
