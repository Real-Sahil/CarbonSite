import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import React from "react";
import { needsTermsAcceptance } from "@/lib/legal/terms";
import { TermsGate } from "./terms-gate";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Invited, SSO, supplier and bulk-created accounts never saw the sign-up checkbox. Until they accept the current
  // Terms they go no further in the web app; the API is unchanged, so installed mobile builds keep working.
  // The gate is rendered here, not on its own route, because Vercel's Hobby plan caps functions per deployment.
  const terms = await prisma.user.findUnique({ where: { id: session.user.id }, select: { termsVersion: true } });
  if (needsTermsAcceptance(terms?.termsVersion)) {
    return <TermsGate />;
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
