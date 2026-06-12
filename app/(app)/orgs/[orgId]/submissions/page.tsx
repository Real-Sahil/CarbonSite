import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubmissionsPageProps {
  params: Promise<{ orgId: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  needs_info: "Needs info",
};

const STATUS_CLASSES: Record<string, string> = {
  pending:
    "border-[#e5e7eb] bg-[#e1f4df] text-[#0f3e17]",
  submitted:
    "border-[#b6ced5] bg-[#b6ced5]/30 text-[#0f3e17]",
  under_review:
    "border-[#b6ced5] bg-[#b6ced5]/50 text-[#0f3e17]",
  approved:
    "border-[#b1dbb8] bg-[#cfe7d3] text-[#0f3e17]",
  rejected:
    "border-[#e5e7eb] bg-[#e5e7eb] text-[#333333]",
  needs_info:
    "border-[#b6ced5] bg-[#b6ced5]/20 text-[#0f3e17]",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  waste_ticket: "Waste ticket",
  delivery_note: "Delivery note",
  fuel_receipt: "Fuel receipt",
  other: "Other",
};

export default async function SubmissionsPage({
  params,
}: SubmissionsPageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer");
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

  const submissions = await prisma.fieldSubmission.findMany({
    where: { organizationId: orgId },
    include: {
      submittedBy: { select: { name: true, email: true } },
      reportingPeriod: { select: { label: true } },
      facility: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Submissions
            <span className="ml-2 text-sm font-normal text-[#333333]">
              ({submissions.length})
            </span>
          </CardTitle>
          {submissions.length === 0 && (
            <CardDescription>
              Share an invite link with your field workers to get started.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className={submissions.length === 0 ? "pb-8" : "p-0 pb-2"}>
          {submissions.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e1f4df]">
                <Inbox aria-hidden="true" className="h-7 w-7 text-[#0f3e17]" />
              </div>
              <div>
                <p className="font-normal text-[#0f3e17] tracking-[-0.42px]">
                  No field submissions yet
                </p>
                <p className="text-sm text-[#222222] tracking-[-0.42px] mt-[7px] max-w-sm">
                  Share an invite link with your field workers to get started.
                  Field workers photograph waste tickets, delivery notes, and
                  fuel receipts directly from the mobile app.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted by</TableHead>
                  <TableHead>Reporting period</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/orgs/${orgId}/submissions/${s.id}`}
                        className="hover:underline underline-offset-2 text-[#0f3e17]"
                      >
                        {DOC_TYPE_LABELS[s.documentType] ?? s.documentType}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-[14px] py-[7px] text-xs font-normal tracking-[-0.36px]",
                          STATUS_CLASSES[s.status] ??
                            "border-[#e5e7eb] bg-[#e1f4df] text-[#333333]"
                        )}
                      >
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-[#222222]">
                      {s.submittedBy.name ?? s.submittedBy.email}
                    </TableCell>
                    <TableCell className="text-[#222222]">
                      {s.reportingPeriod.label}
                    </TableCell>
                    <TableCell className="text-[#222222]">
                      {s.facility?.name ?? (
                        <span className="text-[#333333] italic">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[#333333] text-sm tracking-[-0.36px]">
                      {s.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
