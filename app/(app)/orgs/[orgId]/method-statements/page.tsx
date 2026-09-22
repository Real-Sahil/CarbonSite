export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NewMethodStatementButton } from "./method-statements-actions";

const STATUS_COLORS: Record<string, string> = {
  draft:      "bg-gray-100 text-gray-700",
  review:     "bg-amber-100 text-amber-800",
  approved:   "bg-blue-100 text-blue-800",
  issued:     "bg-green-100 text-green-800",
  signed_off: "bg-green-100 text-green-800",
  superseded: "bg-gray-100 text-gray-500",
};

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function MethodStatementsPage({ params }: PageProps) {
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

  const items = await prisma.methodStatement.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, title: true, version: true, status: true,
      issuedAt: true, expiresAt: true, createdAt: true,
      project: { select: { name: true } },
      site: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Method Statements / RAMS</h1>
          <p className="text-sm text-muted-foreground mt-1">Risk assessments and method statements for site activities.</p>
        </div>
        {canEdit && <NewMethodStatementButton orgId={orgId} />}
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-16 text-center">No method statements yet.</div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Version</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Project</th>
                <th className="px-4 py-3 text-left font-medium">Issued</th>
                <th className="px-4 py-3 text-left font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ms) => (
                <tr key={ms.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/orgs/${orgId}/method-statements/${ms.id}`} className="hover:underline">{ms.title}</Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{ms.version}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[ms.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {ms.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ms.project?.name ?? "-"}</td>
                  <td className="px-4 py-3">{ms.issuedAt ? new Date(ms.issuedAt).toLocaleDateString("en-GB") : "-"}</td>
                  <td className="px-4 py-3">{ms.expiresAt ? new Date(ms.expiresAt).toLocaleDateString("en-GB") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
