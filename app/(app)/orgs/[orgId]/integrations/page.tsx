export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Zap,
  BarChart3,
  FileText,
  Truck,
} from "lucide-react";

interface IntegrationsPageProps {
  params: Promise<{ orgId: string }>;
}

export async function generateMetadata({ params }: IntegrationsPageProps) {
  const { orgId } = await params;
  return {
    title: "Integrations | CarbonSite",
    description: "Connect your accounting software and invite suppliers to collaborate on emissions data",
  };
}

export default async function IntegrationsPage({ params }: IntegrationsPageProps) {
  const { orgId } = await params;

  await requireOrgMember(orgId, "admin", "editor");

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#f97316]" />
            <span className="text-sm font-semibold text-[#f97316] uppercase tracking-widest">Integrations</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Connect Your Tools</h1>
          <p className="text-slate-500">
            Integrate your accounting software and collaborate with suppliers to automate emissions data collection.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8">
          {/* Accounting Section */}
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2 mb-2">
                <BarChart3 className="h-5 w-5 text-[#f97316]" />
                Accounting Software
              </h2>
              <p className="text-slate-500">Connect your accounting platform to automatically sync invoices and calculate Scope 3 emissions from supplier spend.</p>
            </div>

            <Link href={`/orgs/${orgId}/integrations/accounting`}>
              <Card className="border-[#E5E7EB] bg-white hover:bg-slate-50 shadow-sm transition-all cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-slate-900">Xero, QuickBooks &amp; Sage</CardTitle>
                      <CardDescription>Connect an accounting platform</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
                      Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Automatically sync invoices and bill details to calculate spend-based Scope 3 emissions from your suppliers.
                  </p>
                  <div className="flex items-center text-[#f97316] text-sm font-medium">
                    Manage Accounting Connections <ArrowRight className="h-4 w-4 ml-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Supplier Section */}
          <div className="border-t border-[#E5E7EB] pt-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2 mb-2">
                <Truck className="h-5 w-5 text-[#f97316]" />
                Supplier Collaboration
              </h2>
              <p className="text-slate-500">Invite suppliers to submit emissions data or respond to surveys. Collect Scope 3 data directly from your supply chain.</p>
            </div>

            <Link href={`/orgs/${orgId}/integrations/suppliers`}>
              <Card className="border-[#E5E7EB] bg-white hover:bg-slate-50 shadow-sm transition-all cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-slate-900">Invite Suppliers</CardTitle>
                      <CardDescription>Collect supply chain emissions data</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
                      Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Send secure links to suppliers to submit emissions data, facilities information, and facility photos. Track supplier responses and maintain audit trails for compliance.
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center text-[#f97316] text-sm font-medium">
                      Manage Suppliers <ArrowRight className="h-4 w-4 ml-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Data Lineage Section */}
          <div className="border-t border-[#E5E7EB] pt-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-[#f97316]" />
                Data Quality & Monitoring
              </h2>
              <p className="text-slate-500">View data lineage, audit trails, and ensure data integrity across all integration sources.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Link href={`/orgs/${orgId}/audit/data-lineage`}>
                <Card className="border-[#E5E7EB] bg-white hover:bg-slate-50 shadow-sm transition-all cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-slate-900">Data Lineage</CardTitle>
                    <CardDescription>Track data from source to report</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 mb-4">
                      See the complete journey of your emissions data. Trace any record back to its source, the factors applied, and the calculation method used.
                    </p>
                    <div className="flex items-center text-[#f97316] text-sm font-medium">
                      View Lineage <ArrowRight className="h-4 w-4 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href={`/orgs/${orgId}/audit`}>
                <Card className="border-[#E5E7EB] bg-white hover:bg-slate-50 shadow-sm transition-all cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-slate-900">Audit Trail</CardTitle>
                    <CardDescription>Immutable activity log</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 mb-4">
                      Review all changes made to emissions data, calculations, and reports. Maintain compliance with regulatory requirements.
                    </p>
                    <div className="flex items-center text-[#f97316] text-sm font-medium">
                      View Audit Trail <ArrowRight className="h-4 w-4 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
