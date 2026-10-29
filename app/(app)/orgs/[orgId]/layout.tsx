import { redirect } from "next/navigation";
import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { OrgSidebar } from "@/components/org-sidebar";
import { CommandPalette } from "@/components/org/command-palette";
import { OrgTopBar } from "@/components/org/org-topbar";
import { AppearanceSync } from "@/components/org/appearance";
import { parseThemeChoice } from "@/lib/theme/preference";
import { viewRoles } from "@/lib/saved-views/roles";
import { paymentState } from "@/lib/billing/dunning";
import { PageTransition } from "@/components/page-transition";
import React from "react";
import { getOrgBasics } from "@/lib/i18n/org-basics";
import { localeForCountry, orgFormat } from "@/lib/i18n/org-format";
import { OrgLocaleProvider } from "@/components/org/org-locale";
import { buttonVariants } from "@/components/ui/button";
import { getSelectedProject } from "@/lib/project/selected";
import { brandingCss, brandingVars } from "@/lib/branding/css-vars";
import { cookies } from "next/headers";
import { EARTHY_COOKIE, earthyEnabled } from "@/lib/dashboard/earthy-flag";
import { EarthyTabBar } from "@/components/earthy/tab-bar";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgId } = await params;

  let session: Awaited<ReturnType<typeof requireOrgMember>>["session"] | undefined;
  let membership: Awaited<ReturnType<typeof requireOrgMember>>["membership"] | undefined;
  let layoutAuthErr: AuthError | null = null;
  let layoutDbErr = false;

  try {
    const result = await requireOrgMember(orgId);
    session = result.session;
    membership = result.membership;
  } catch (err) {
    if (err instanceof AuthError) {
      layoutAuthErr = err;
    } else {
      layoutDbErr = true;
    }
  }

  // redirect() must be called outside try/catch — it throws NEXT_REDIRECT internally
  if (layoutAuthErr) {
    if (layoutAuthErr.status === 401) {
      redirect("/sign-in");
    }
    // 403 - access denied (not a member, insufficient role, etc.)
    const message =
      layoutAuthErr.code === "NOT_MEMBER"
        ? "You are not a member of this organisation."
        : layoutAuthErr.code === "INSUFFICIENT_ROLE"
        ? "You don't have permission to access this area."
        : "You don't have access to this organisation.";
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-3xl tracking-tight text-[#131d29] mb-2">
            Access denied
          </h1>
          <p className="text-sm text-[#5B6A78]">
            {message}
          </p>
        </div>
      </div>
    );
  }

  // Field workers and supplier accounts have no access to the org portal.
  // Their own surfaces live outside this layout (anything under /orgs/[orgId]
  // would redirect back here in a loop): /app points field workers at the
  // mobile app, and suppliers have the supplier portal.
  if (membership?.role === "field_worker") redirect("/app");
  if (membership?.role === "supplier") redirect("/supplier-portal");

  if (layoutDbErr) {
    // Non-AuthError from Prisma (e.g. missing DB column) — show a recoverable error
    // rather than crashing the layout and making every page inaccessible.
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="text-center max-w-sm px-6">
          <h1 className="text-2xl tracking-tight text-[#131d29] mb-2">
            Temporary error
          </h1>
          <p className="text-sm text-[#5B6A78] mb-4">
            The database is updating. Refresh in a moment.
          </p>
          <a
            href=""
            className={buttonVariants()}
          >
            Refresh
          </a>
        </div>
      </div>
    );
  }

  let org: { id: string; name: string; hqCountry: string | null; reportingCurrency: string | null } | null = null;
  let branding: { primaryHex: string | null; accentHex: string | null; fontFamily: string | null } | null = null;
  let dataFetchError: string | null = null;

  try {
    [org, branding] = await Promise.all([
      getOrgBasics(orgId).catch((err) => {
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
          <h1 className="text-2xl tracking-tight text-[#131d29] mb-2">
            Temporary error
          </h1>
          <p className="text-sm text-[#5B6A78] mb-4">
            {dataFetchError}
          </p>
          <a
            href=""
            className={buttonVariants()}
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
    name: session!.user.name,
    email: session!.user.email,
  };
  // The person's own appearance choice, read with the session (no extra query).
  const themePreference = parseThemeChoice(session!.user.themePreference);

  const cssVars = brandingCss(brandingVars(branding));

  // Failed renewal: admins see the grace period, or that new work is blocked.
  const payment =
    membership!.role === "admin"
      ? paymentState(
          await prisma.billingSubscription
            .findUnique({ where: { organizationId: orgId }, select: { status: true, paymentFailedAt: true } })
            .catch(() => null),
        )
      : ({ state: "ok" } as const);

  // Project switcher: every project of the organisation, newest first, and the one picked.
  const [projects, selectedProject] = await Promise.all([
    prisma.project.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, name: true } }).catch(() => []),
    getSelectedProject(orgId).catch(() => null),
  ]);

  // Earthy Tech rollout (docs/design/earthy-tech): the whole shell follows the same flag as the Summary.
  const earthy = earthyEnabled(orgId, {
    previewParam: (await cookies()).get(EARTHY_COOKIE)?.value,
    isAdmin: membership!.role === "admin",
  });

  const reviewWaiting = earthy
    ? await prisma.fieldSubmission
        .count({ where: { organizationId: orgId, status: { in: ["pending", "submitted", "under_review", "needs_info"] } } })
        .catch(() => 0)
    : 0;

  return (
    <div className={`flex flex-col md:flex-row min-h-[100dvh] ${earthy ? "earthy earthy-shell" : "bg-[#F9FAFC]"}`}>
      {cssVars && <style>{cssVars}</style>}
      <AppearanceSync saved={themePreference} />
      <OrgSidebar orgId={orgId} orgName={org.name} user={user} role={membership!.role} projects={projects} selectedProjectId={selectedProject?.id ?? null} themePreference={themePreference} />
      <CommandPalette orgId={orgId} role={membership!.role} canUseViews={viewRoles().includes(membership!.role)} />
      {/* The column wraps the top bar and main so the bar sticks to the viewport, not to main (which never scrolls on its own). */}
      <div className="flex flex-1 min-w-0 flex-col">
        <OrgTopBar orgId={orgId} user={user} themePreference={themePreference} />
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-auto">
          {payment.state !== "ok" ? (
            <div role="status" className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5 text-sm sm:px-8 ${payment.state === "blocked" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <span>
                {payment.state === "blocked"
                  ? "The latest payment has not gone through, so adding records, calculating and generating reports are paused. Your data stays readable."
                  : `The latest payment did not go through. Update the card by ${payment.blocksOn.toLocaleDateString("en-GB", { day: "numeric", month: "long" })} to keep adding and calculating data.`}
              </span>
              <a href={`/orgs/${orgId}/settings/billing`} className="font-medium underline underline-offset-2">
                Update payment details
              </a>
            </div>
          ) : null}
          <OrgLocaleProvider locale={localeForCountry(org?.hqCountry)} currency={orgFormat(org ?? {}).currency}>
            <PageTransition>{children}</PageTransition>
          </OrgLocaleProvider>
        </main>
      </div>
      {earthy && <EarthyTabBar orgId={orgId} recordsBadge={reviewWaiting} />}
    </div>
  );
}
