import Link from "next/link";
import { requirePlatformMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PlatformPage() {
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

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      _count: { select: { memberships: true, activityRecords: true } },
    },
  });

  const totalMembers = orgs.reduce((sum, org) => sum + org._count.memberships, 0);

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[42px]">
      <div>
        <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Platform
        </p>
        <h1
          className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          Platform Admin
        </h1>
        <p className="text-sm text-[#222222] font-normal tracking-[-0.42px] mt-[7px]">
          Super-admin view of all organisations on the platform.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-[14px] border border-[#e5e7eb] p-[21px]">
          <p className="text-xs font-normal uppercase tracking-wide text-[#333333]">
            Total orgs
          </p>
          <p className="mt-2 text-3xl font-normal tracking-[-0.4px] text-[#0f3e17]">
            {orgs.length.toLocaleString("en-GB")}
          </p>
        </div>
        <div className="rounded-[14px] border border-[#e5e7eb] p-[21px]">
          <p className="text-xs font-normal uppercase tracking-wide text-[#333333]">
            Total members
          </p>
          <p className="mt-2 text-3xl font-normal tracking-[-0.4px] text-[#0f3e17]">
            {totalMembers.toLocaleString("en-GB")}
          </p>
        </div>
      </div>

      {/* Orgs table */}
      <div className="rounded-[14px] border border-[#e5e7eb] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="text-right">Records</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="font-normal text-[#0f3e17] tracking-[-0.42px]">
                  {org.name}
                </TableCell>
                <TableCell className="text-right text-sm text-[#222222] tracking-[-0.42px]">
                  {org._count.memberships.toLocaleString("en-GB")}
                </TableCell>
                <TableCell className="text-right text-sm text-[#222222] tracking-[-0.42px]">
                  {org._count.activityRecords.toLocaleString("en-GB")}
                </TableCell>
                <TableCell className="text-sm text-[#333333] tracking-[-0.42px]">
                  {org.createdAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/platform/orgs/${org.id}`}
                    className="text-xs text-[#0f3e17] hover:underline tracking-[-0.36px]"
                  >
                    View &rarr;
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {orgs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-[#333333] py-8">
                  No organisations yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
