import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SubmissionsTable } from "./submissions-table";

interface SubmissionsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function SubmissionsPage({
  params,
}: SubmissionsPageProps) {
  const { orgId } = await params;

  let members: { id: string; name: string | null; email: string }[] = [];
  let initialSubmissions: {
    id: string;
    documentType: string;
    status: string;
    createdAt: string;
    submittedBy: { name: string | null; email: string };
    reportingPeriod: { label: string };
    facility: { name: string } | null;
  }[] = [];

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const [memberships, submissions] = await Promise.all([
      prisma.organizationMembership.findMany({
        where: { organizationId: orgId, role: { in: ["admin", "editor", "reviewer"] } },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.fieldSubmission.findMany({
        where: { organizationId: orgId },
        include: {
          submittedBy: { select: { name: true, email: true } },
          reportingPeriod: { select: { label: true } },
          facility: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    members = memberships.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email }));
    initialSubmissions = submissions.map((s) => ({
      id: s.id,
      documentType: s.documentType,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      submittedBy: { name: s.submittedBy.name, email: s.submittedBy.email },
      reportingPeriod: { label: s.reportingPeriod?.label ?? "" },
      facility: s.facility ? { name: s.facility.name } : null,
    }));
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8">
          <p className="text-red-600">
            You do not have permission to view submissions.
          </p>
        </div>
      );
    }
    throw err;
  }

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto">
      <div className="mb-[42px]">
        <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Review
        </p>
        <h1
          className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          Field submissions
        </h1>
        <p className="text-sm text-[#222222] font-normal tracking-[-0.42px] mt-[7px]">
          Review incoming submissions from field workers before approving them
          as activity records.
        </p>
      </div>

      <SubmissionsTable orgId={orgId} members={members} initialSubmissions={initialSubmissions} />
    </div>
  );
}
