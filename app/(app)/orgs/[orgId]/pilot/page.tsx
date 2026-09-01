import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { GenerateKitForm } from "./generate-kit-form";

interface PilotPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function PilotPage({ params }: PilotPageProps) {
  const { orgId } = await params;

  try {
    // Authorization: admin or editor only
    await requireOrgMember(orgId, "admin", "editor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      redirect(`/orgs/${orgId}/dashboard`);
    }
    throw err;
  }

  // Fetch organization details
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, createdAt: true },
  });

  if (!org) {
    redirect("/");
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <div className="space-y-2 mb-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-slate-900">
              Pilot Program Documentation
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl">
              Generate a comprehensive documentation kit for your organization's 90-day pilot program with CarbonSite.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="font-semibold">Organization:</span>
            <span>{org.name}</span>
          </div>
        </div>

        {/* Information Boxes */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-1">6 Customized Documents</h3>
            <p className="text-sm text-blue-800">
              Executive summary, manager guides, technical integration, and compliance documentation
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h3 className="font-semibold text-emerald-900 mb-1">Role-Specific Content</h3>
            <p className="text-sm text-emerald-800">
              Tailored guides for executives, finance, sustainability, IT, and compliance teams
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-semibold text-amber-900 mb-1">Framework Mapping</h3>
            <p className="text-sm text-amber-800">
              CSRD, SBTi, CDP, and GHG Protocol compliance guidance included
            </p>
          </div>
        </div>

        {/* Form */}
        <GenerateKitForm orgId={orgId} organizationName={org.name} />
      </div>
    </div>
  );
}
