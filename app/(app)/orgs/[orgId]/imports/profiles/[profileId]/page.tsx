export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadProfile } from "@/lib/imports/profile-store";
import { ProfileEditor } from "../profile-editor";

/** /imports/profiles/new creates a profile; any other id edits that profile. */
export default async function ImportProfilePage({ params }: { params: Promise<{ orgId: string; profileId: string }> }) {
  const { orgId, profileId } = await params;
  try {
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    if (err instanceof AuthError) return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to edit import profiles.</div>;
    throw err;
  }

  const [profile, categories] = await Promise.all([
    profileId === "new" ? Promise.resolve(null) : loadProfile(orgId, profileId),
    prisma.emissionCategory.findMany({ select: { code: true, name: true, scope: true }, orderBy: [{ scope: "asc" }, { code: "asc" }] }),
  ]);
  if (profileId !== "new" && !profile) notFound();

  return (
    <div className="min-h-[100dvh] bg-[#f9fafb]">
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
          <Link href={`/orgs/${orgId}/imports/profiles`} className="inline-flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#111827]">
            <ArrowLeft aria-hidden="true" className="h-3 w-3" /> ERP export profiles
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#111827]">{profile ? profile.name : "New ERP export profile"}</h1>
        </div>
      </div>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
        <ProfileEditor orgId={orgId} categories={categories} initial={profile ? { id: profile.id, name: profile.name, spec: profile.spec } : undefined} />
      </div>
    </div>
  );
}
