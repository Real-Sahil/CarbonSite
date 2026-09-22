export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { AlertOctagon } from "lucide-react";
import { RecordNoticeButton } from "./enforcement-notices-actions";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-800",
  appealed: "bg-yellow-100 text-yellow-800",
  complied: "bg-green-100 text-green-800",
  extended: "bg-orange-100 text-orange-800",
  withdrawn: "bg-gray-100 text-gray-700",
  overdue: "bg-red-200 text-red-900",
};

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function EnforcementNoticesPage({ params }: PageProps) {
  const { orgId } = await params;

  let canEdit = false;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    canEdit = ["admin", "editor"].includes(result.membership.role);
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <div className="p-8 text-sm text-red-600">Access denied.</div>;
    }
    return <div className="p-8 text-sm text-red-600">Failed to load page. Try refreshing.</div>;
  }

  const notices = await prisma.enforcementNotice.findMany({
    where: { organizationId: orgId },
    orderBy: { issuedAt: "desc" },
    take: 100,
    select: {
      id: true, reference: true, issuingBody: true, noticeType: true,
      status: true, issuedAt: true, complianceDeadline: true, compliedAt: true, subject: true,
    },
  });

  const now = new Date();
  const overdueCount = notices.filter(
    (n) => !n.compliedAt && n.complianceDeadline && new Date(n.complianceDeadline) < now
  ).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enforcement Notices</h1>
          <p className="text-sm text-muted-foreground mt-1">Track regulatory enforcement notices, compliance deadlines, and appeals.</p>
        </div>
        {canEdit && <RecordNoticeButton orgId={orgId} />}
      </div>

      {overdueCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertOctagon className="h-4 w-4 flex-shrink-0" />
          <span>{overdueCount} notice{overdueCount !== 1 ? "s" : ""} with overdue compliance deadlines.</span>
        </div>
      )}

      {notices.length === 0 ? (
        <div className="text-sm text-muted-foreground py-16 text-center">No enforcement notices recorded.</div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Reference</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Issuing Body</th>
                <th className="px-4 py-3 text-left font-medium">Issued</th>
                <th className="px-4 py-3 text-left font-medium">Deadline</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {notices.map((n) => (
                <tr key={n.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{n.reference}</td>
                  <td className="px-4 py-3 capitalize">{n.noticeType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{n.issuingBody}</td>
                  <td className="px-4 py-3">{new Date(n.issuedAt).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3">
                    {n.complianceDeadline ? (
                      <span className={!n.compliedAt && new Date(n.complianceDeadline) < now ? "text-red-600 font-medium" : ""}>
                        {new Date(n.complianceDeadline).toLocaleDateString("en-GB")}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[n.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {n.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
