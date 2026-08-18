export const dynamic = "force-dynamic";

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
import { SeedLibrariesButton } from "./seed-libraries-button";

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

  const [orgs, factorLibraries] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        _count: { select: { memberships: true, activityRecords: true } },
      },
    }),
    prisma.factorLibrary.findMany({
      include: { _count: { select: { factors: true } } },
      orderBy: [{ name: "asc" }, { version: "desc" }],
    }),
  ]);

  const totalMembers = orgs.reduce((sum, org) => sum + org._count.memberships, 0);
  const missingStandardLibraries =
    !factorLibraries.some((l) => l.name === "DEFRA") ||
    !factorLibraries.some((l) => l.name === "EPA");

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[42px]">
      <div>
        <p className="text-xs font-normal tracking-[-0.36px] text-[#111827] bg-[#F0F9FF] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Platform
        </p>
        <h1
          className="text-2xl font-bold tracking-tight text-[#111827]"
          
        >
          Platform Admin
        </h1>
        <p className="text-sm text-[#374151] font-normal tracking-[-0.42px] mt-[7px]">
          Super-admin view of all organisations on the platform.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-[14px] border border-[#E5E7EB] p-[21px]">
          <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">
            Total orgs
          </p>
          <p className="mt-2 text-3xl font-normal tracking-[-0.4px] text-[#111827]">
            {orgs.length.toLocaleString("en-GB")}
          </p>
        </div>
        <div className="rounded-[14px] border border-[#E5E7EB] p-[21px]">
          <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">
            Total members
          </p>
          <p className="mt-2 text-3xl font-normal tracking-[-0.4px] text-[#111827]">
            {totalMembers.toLocaleString("en-GB")}
          </p>
        </div>
      </div>

      {/* Factor libraries */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Factor libraries</h2>
            <p className="text-xs text-[#374151] tracking-[-0.36px] mt-0.5">
              Global emission factor libraries available to all orgs for calculation runs.
            </p>
          </div>
          <SeedLibrariesButton />
        </div>
        {missingStandardLibraries && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            One or more standard libraries (DEFRA 2025.1, EPA 2025.1) are missing. Click
            &ldquo;Seed standard libraries&rdquo; to create them.
          </p>
        )}
        <div className="rounded-[14px] border border-[#E5E7EB] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Library</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Factor rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factorLibraries.map((lib) => (
                <TableRow key={lib.id}>
                  <TableCell className="font-normal text-[#111827] tracking-[-0.42px]">
                    {lib.name}
                  </TableCell>
                  <TableCell className="text-sm text-[#374151]">{lib.version}</TableCell>
                  <TableCell className="text-right text-sm text-[#374151] tabular-nums">
                    {lib._count.factors.toLocaleString("en-GB")}
                  </TableCell>
                </TableRow>
              ))}
              {factorLibraries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-[#374151] py-6">
                    No factor libraries yet. Seed them above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Orgs table */}
      <div className="rounded-[14px] border border-[#E5E7EB] overflow-hidden">
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
                <TableCell className="font-normal text-[#111827] tracking-[-0.42px]">
                  {org.name}
                </TableCell>
                <TableCell className="text-right text-sm text-[#374151] tracking-[-0.42px]">
                  {org._count.memberships.toLocaleString("en-GB")}
                </TableCell>
                <TableCell className="text-right text-sm text-[#374151] tracking-[-0.42px]">
                  {org._count.activityRecords.toLocaleString("en-GB")}
                </TableCell>
                <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                  {org.createdAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/platform/orgs/${org.id}`}
                    className="text-xs text-[#111827] hover:underline tracking-[-0.36px]"
                  >
                    View &rarr;
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {orgs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-[#374151] py-8">
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
