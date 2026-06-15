import Link from "next/link";
import { requirePlatformMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PlanSelector } from "./plan-selector";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  params: Promise<{ orgId: string }>;
}

export default async function PlatformOrgDetailPage({ params }: Props) {
  const { orgId } = await params;

  try {
    await requirePlatformMember();
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-[42px]">
          <p className="text-red-600 text-sm">Platform access denied.</p>
        </div>
      );
    }
    throw err;
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: {
      memberships: {
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      reportingPeriods: {
        select: { id: true, label: true, status: true },
        orderBy: { startDate: "desc" },
      },
      _count: { select: { activityRecords: true, contracts: true } },
    },
  });

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[42px]">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[#333333] tracking-[-0.42px]">
        <Link href="/platform" className="hover:text-[#0f3e17] transition-colors">
          Platform Admin
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[#0f3e17]">{org.name}</span>
      </nav>

      {/* Heading */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex">
          Platform
        </p>
        <h1
          className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          {org.name}
        </h1>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-normal uppercase tracking-wide text-[#333333]">Plan</p>
          <PlanSelector orgId={orgId} currentPlan={org.plan} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-[14px] border border-[#e5e7eb] p-[21px]">
          <p className="text-xs font-normal uppercase tracking-wide text-[#333333]">Members</p>
          <p className="mt-2 text-3xl font-normal tracking-[-0.4px] text-[#0f3e17]">
            {org.memberships.length.toLocaleString("en-GB")}
          </p>
        </div>
        <div className="rounded-[14px] border border-[#e5e7eb] p-[21px]">
          <p className="text-xs font-normal uppercase tracking-wide text-[#333333]">Activity records</p>
          <p className="mt-2 text-3xl font-normal tracking-[-0.4px] text-[#0f3e17]">
            {org._count.activityRecords.toLocaleString("en-GB")}
          </p>
        </div>
        <div className="rounded-[14px] border border-[#e5e7eb] p-[21px]">
          <p className="text-xs font-normal uppercase tracking-wide text-[#333333]">Contracts</p>
          <p className="mt-2 text-3xl font-normal tracking-[-0.4px] text-[#0f3e17]">
            {org._count.contracts.toLocaleString("en-GB")}
          </p>
        </div>
      </div>

      {/* Members table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            {org.memberships.length} member{org.memberships.length !== 1 ? "s" : ""} in this organisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {org.memberships.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-normal text-[#0f3e17] tracking-[-0.42px]">
                    {m.user.name ?? (
                      <span className="text-[#333333] italic">No name</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-[#222222] tracking-[-0.42px]">
                    {m.user.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal text-xs">
                      {m.role.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-[#333333] tracking-[-0.42px]">
                    {m.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                </TableRow>
              ))}
              {org.memberships.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-[#333333] py-8">
                    No members yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reporting periods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reporting periods</CardTitle>
          <CardDescription>
            {org.reportingPeriods.length} reporting period{org.reportingPeriods.length !== 1 ? "s" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {org.reportingPeriods.length > 0 ? (
            <div className="flex flex-col divide-y divide-[#e5e7eb] rounded-[14px] border border-[#e5e7eb] overflow-hidden">
              {org.reportingPeriods.map((period) => (
                <div
                  key={period.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <p className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">
                    {period.label}
                  </p>
                  <Badge variant="outline" className="font-normal text-xs capitalize">
                    {period.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#333333] tracking-[-0.42px]">
              No reporting periods created yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
