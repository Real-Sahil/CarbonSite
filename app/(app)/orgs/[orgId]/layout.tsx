import { redirect } from "next/navigation";
import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { OrgSidebar } from "@/components/org-sidebar";
import React from "react";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgId } = await params;

  let session: Awaited<ReturnType<typeof requireOrgMember>>["session"];

  try {
    const result = await requireOrgMember(orgId);
    session = result.session;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) {
        redirect("/sign-in");
      }
      // 403 - not a member
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#fffefc]">
          <div className="text-center">
            <h1
              className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17] mb-[7px]"
              style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
            >
              Access denied
            </h1>
            <p className="text-sm text-[#222222] tracking-[-0.42px]">
              You are not a member of this organisation.
            </p>
          </div>
        </div>
      );
    }
    throw err;
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  });

  if (!org) {
    redirect("/");
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#fffefc]">
      <OrgSidebar orgId={orgId} orgName={org.name} user={user} />
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
