import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { CalendarDays } from "lucide-react";

interface Props {
  params: Promise<{ orgId: string }>;
}

export default async function ReportingPeriodsPage({ params }: Props) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8">
          <p className="text-red-600 text-sm">You do not have permission to manage reporting periods.</p>
        </div>
      );
    }
    throw err;
  }

  const periods = await prisma.reportingPeriod.findMany({
    where: { organizationId: orgId },
    orderBy: { startDate: "desc" },
    select: { id: true, label: true, startDate: true, endDate: true, status: true },
  });

  return (
    <div className="flex flex-col gap-[28px] max-w-4xl">
      {periods.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No reporting periods yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Reporting period management will be available here. Contact support to configure periods.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {periods.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-xs text-muted-foreground">
                  {p.startDate.toLocaleDateString()} &ndash; {p.endDate.toLocaleDateString()}
                </p>
              </div>
              {p.status === "locked" && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  Locked
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
