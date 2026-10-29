import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import React from "react";
import { needsTermsAcceptance } from "@/lib/legal/terms";
import { brandingVars } from "@/lib/branding/css-vars";
import { MotionProvider } from "@/components/motion-provider";
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
    return <MotionProvider><TermsGate /></MotionProvider>;
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
      const vars = brandingVars(branding);
      if (Object.keys(vars).length > 0) {
        brandingStyle = vars as React.CSSProperties;
      }
    }
  }

  if (brandingStyle) {
    return <MotionProvider><div style={brandingStyle}>{children}</div></MotionProvider>;
  }

  // Only the signed-in app animates with motion, so only it pays for the library; public pages stay lean.
  return <MotionProvider>{children}</MotionProvider>;
}
