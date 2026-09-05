export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Truck,
  CheckCircle,
} from "lucide-react";
import { SupplierInviteForm } from "@/components/suppliers/invite-form";
import { SupplierInvitesList } from "@/components/suppliers/invites-list";

interface SuppliersPageProps {
  params: Promise<{ orgId: string }>;
}

export async function generateMetadata({ params }: SuppliersPageProps) {
  const { orgId } = await params;
  return {
    title: "Supplier Invitations | CarbonSite",
    description: "Invite suppliers to submit emissions data and collaborate on Scope 3 calculations",
  };
}

export default async function SuppliersPage({ params }: SuppliersPageProps) {
  const { orgId } = await params;

  const user = await requireOrgMember(orgId, "admin", "editor");

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { name: true },
  });

  const invites = await prisma.supplierInvite.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      email: true,
      companyName: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
      inviteMethod: true,
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Link href={`/orgs/${orgId}/integrations`} className="flex items-center gap-2 text-[#f97316] hover:text-orange-600 mb-4">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Integrations</span>
          </Link>
          <div className="mb-2 flex items-center gap-2">
            <Truck className="h-5 w-5 text-[#f97316]" />
            <span className="text-sm font-semibold text-[#f97316] uppercase tracking-widest">Supplier Management</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Invite Suppliers to Collaborate</h1>
          <p className="text-slate-500">
            Send secure invitations to suppliers to submit emissions data, facility information, and supporting documentation.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8">
          {/* Invite Section */}
          <SupplierInviteForm orgId={orgId} />

          {/* Pending Invitations */}
          <SupplierInvitesList orgId={orgId} invites={invites} />

          {/* How It Works */}
          <Card className="border-[#E5E7EB] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">How Supplier Collaboration Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7ed] text-[#f97316] font-semibold text-sm flex-shrink-0">1</div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">You Send Invitation</h4>
                    <p className="text-sm text-slate-600">Create an invitation with the supplier&apos;s email and send them a secure link.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7ed] text-[#f97316] font-semibold text-sm flex-shrink-0">2</div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Supplier Submits Data</h4>
                    <p className="text-sm text-slate-600">They fill out a simple form with facility info, emissions data, and can upload supporting documents. No account needed.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7ed] text-[#f97316] font-semibold text-sm flex-shrink-0">3</div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Your Team Reviews</h4>
                    <p className="text-sm text-slate-600">Submissions appear in your review queue. You can approve, request clarifications, or reject with feedback.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7ed] text-[#f97316] font-semibold text-sm flex-shrink-0">4</div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Data Powers Your Reports</h4>
                    <p className="text-sm text-slate-600">Approved supplier data is included in your Scope 3 calculations and audit-ready reports.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Best Practices */}
          <Card className="border-[#E5E7EB] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Best Practices for Supplier Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-slate-900">Start early:</strong> Begin supplier outreach before your reporting deadline</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-slate-900">Prioritize Tier 1:</strong> Focus first on direct suppliers with largest spend</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-slate-900">Follow up:</strong> Send reminders after 1 week and 2 weeks if no response</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-slate-900">Provide context:</strong> Explain why emissions data matters to your business</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-slate-900">Use estimates:</strong> CarbonSite estimates Scope 3 if suppliers don&apos;t respond</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
