import { redirect } from "next/navigation";
import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { OrgSidebar } from "@/components/org-sidebar";
import { PageTransition } from "@/components/page-transition";
import React from "react";

function buildBrandingCssVars(branding: {
  primaryHex: string | null;
  accentHex: string | null;
  fontFamily: string | null;
} | null): string {
  if (!branding) return "";
  const parts: string[] = [];
  if (branding.primaryHex) {
    parts.push(`--color-forest-ink: #${branding.primaryHex.replace(/^#/, "")};`);
    parts.push(`--color-brand-primary: #${branding.primaryHex.replace(/^#/, "")};`);
  }
  if (branding.accentHex) {
    parts.push(`--color-mist-blue: #${branding.accentHex.replace(/^#/, "")};`);
    parts.push(`--color-brand-accent: #${branding.accentHex.replace(/^#/, "")};`);
  }
  if (branding.fontFamily) {
    parts.push(`--font-sans: "${branding.fontFamily}", system-ui, sans-serif;`);
  }
  return parts.join(" ");
}

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgId } = await params;

  let session: Awaited<ReturnType<typeof requireOrgMember>>["session"];
  let membership: Awaited<ReturnType<typeof requireOrgMember>>["membership"];

  try {
    const result = await requireOrgMember(orgId);
    session = result.session;
    membership = result.membership;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) {
        redirect("/sign-in");
      }
      // 403 - not a member
      return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-white">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-[#111827] mb-2">
              Access denied
            </h1>
            <p className="text-sm text-[#6B7280]">
              You are not a member of this organisation.
            </p>
          </div>
        </div>
      );
    }
    // Non-AuthError from Prisma (e.g. missing DB column) — show a recoverable error
    // rather than crashing the layout and making every page inaccessible.
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="text-center max-w-sm px-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827] mb-2">
            Temporary error
          </h1>
          <p className="text-sm text-[#6B7280] mb-4">
            The database is updating. Refresh in a moment.
          </p>
          <a
            href=""
            className="inline-block rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-sm text-white hover:from-orange-400 hover:to-amber-300 transition-all"
          >
            Refresh
          </a>
        </div>
      </div>
    );
  }

  let org: { id: string; name: string } | null = null;
  let branding: { primaryHex: string | null; accentHex: string | null; fontFamily: string | null } | null = null;
  let dataFetchError: string | null = null;

  try {
    [org, branding] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true },
      }).catch((err) => {
        console.error("[OrgLayout] Organization query failed for orgId:", orgId, err);
        throw err;
      }),
      // Graceful fallback: tenant_branding table may not exist during DB migrations.
      prisma.tenantBranding.findUnique({
        where: { organizationId: orgId },
        select: { primaryHex: true, accentHex: true, fontFamily: true },
      }).catch((err) => {
        console.error("[OrgLayout] Branding query failed for orgId:", orgId, err);
        return null;
      }),
    ]);
  } catch (err) {
    console.error("[OrgLayout] Failed to load org/branding for orgId:", orgId, {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    dataFetchError = "Failed to load organization data. Please refresh the page.";
  }

  if (dataFetchError) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="text-center max-w-sm px-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827] mb-2">
            Temporary error
          </h1>
          <p className="text-sm text-[#6B7280] mb-4">
            {dataFetchError}
          </p>
          <a
            href=""
            className="inline-block rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-sm text-white hover:from-orange-400 hover:to-amber-300 transition-all"
          >
            Refresh
          </a>
        </div>
      </div>
    );
  }

  if (!org) {
    redirect("/");
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
  };

  const cssVars = buildBrandingCssVars(branding);

  return (
    <div className="flex flex-col md:flex-row min-h-[100dvh] bg-[#F8F9FA]">
      {cssVars && <style>{`:root { ${cssVars} }`}</style>}
      <OrgSidebar orgId={orgId} orgName={org.name} user={user} role={membership.role} />
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-auto">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
