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
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Access denied
            </h1>
            <p className="text-slate-600">
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
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <OrgSidebar orgId={orgId} orgName={org.name} user={user} />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
