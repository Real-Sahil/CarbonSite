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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Zap,
  Users,
  BarChart3,
  TrendingUp,
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

  const user = await requireOrgMember(orgId, ["admin", "editor"]);

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      name: true,
      plan: true,
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400 uppercase tracking-widest">Integrations</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Connect Your Tools</h1>
          <p className="text-slate-400">
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
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <BarChart3 className="h-5 w-5 text-amber-400" />
                Accounting Software
              </h2>
              <p className="text-slate-400">Connect your accounting platform to automatically sync invoices and calculate Scope 3 emissions from supplier spend.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Xero Card */}
              <Link href={`/orgs/${orgId}/integrations/accounting/xero`}>
                <Card className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/80 transition-all cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-white">Xero</CardTitle>
                        <CardDescription>Cloud accounting platform</CardDescription>
                      </div>
                      <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
                        Popular
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-300">
                      Automatically sync invoices and bill details to calculate spend-based Scope 3 emissions from your suppliers.
                    </p>
                    <div className="flex items-center text-amber-400 text-sm font-medium">
                      Connect Xero <ArrowRight className="h-4 w-4 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              {/* QuickBooks Card */}
              <Link href={`/orgs/${orgId}/integrations/accounting/quickbooks`}>
                <Card className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/80 transition-all cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-white">QuickBooks</CardTitle>
                        <CardDescription>Accounting software</CardDescription>
                      </div>
                      <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10">
                        Coming Soon
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-300">
                      Sync invoice data from QuickBooks Online to track supplier spending and calculate emissions from business travel and purchased goods.
                    </p>
                    <div className="flex items-center text-slate-500 text-sm font-medium cursor-not-allowed">
                      Coming Soon
                    </div>
                  </CardContent>
                </Card>
              </Link>

              {/* Sage Card */}
              <Link href={`/orgs/${orgId}/integrations/accounting/sage`}>
                <Card className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/80 transition-all cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-white">Sage</CardTitle>
                        <CardDescription>ERP and accounting</CardDescription>
                      </div>
                      <Badge variant="outline" className="border-purple-500/50 text-purple-400 bg-purple-500/10">
                        Coming Soon
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-300">
                      Integrate with Sage ERP to collect comprehensive spend data and map to emissions categories automatically.
                    </p>
                    <div className="flex items-center text-slate-500 text-sm font-medium cursor-not-allowed">
                      Coming Soon
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>

          {/* Supplier Section */}
          <div className="border-t border-slate-800 pt-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <Truck className="h-5 w-5 text-amber-400" />
                Supplier Collaboration
              </h2>
              <p className="text-slate-400">Invite suppliers to submit emissions data or respond to surveys. Collect Scope 3 data directly from your supply chain.</p>
            </div>

            <Link href={`/orgs/${orgId}/integrations/suppliers`}>
              <Card className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/80 transition-all cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white">Invite Suppliers</CardTitle>
                      <CardDescription>Collect supply chain emissions data</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
                      Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-300">
                    Send secure links to suppliers to submit emissions data, facilities information, and facility photos. Track supplier responses and maintain audit trails for compliance.
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center text-amber-400 text-sm font-medium">
                      Manage Suppliers <ArrowRight className="h-4 w-4 ml-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Data Lineage Section */}
          <div className="border-t border-slate-800 pt-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-amber-400" />
                Data Quality & Monitoring
              </h2>
              <p className="text-slate-400">View data lineage, audit trails, and ensure data integrity across all integration sources.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Link href={`/orgs/${orgId}/audit/data-lineage`}>
                <Card className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/80 transition-all cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-white">Data Lineage</CardTitle>
                    <CardDescription>Track data from source to report</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-300 mb-4">
                      See the complete journey of your emissions data. Trace any record back to its source, the factors applied, and the calculation method used.
                    </p>
                    <div className="flex items-center text-amber-400 text-sm font-medium">
                      View Lineage <ArrowRight className="h-4 w-4 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href={`/orgs/${orgId}/audit`}>
                <Card className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/80 transition-all cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-white">Audit Trail</CardTitle>
                    <CardDescription>Immutable activity log</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-300 mb-4">
                      Review all changes made to emissions data, calculations, and reports. Maintain compliance with regulatory requirements.
                    </p>
                    <div className="flex items-center text-amber-400 text-sm font-medium">
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
