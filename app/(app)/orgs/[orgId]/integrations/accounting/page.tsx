export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { XeroConnectButton } from "@/components/integrations/xero-connect-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Zap,
  Lock,
  RotateCw,
} from "lucide-react";

interface AccountingPageProps {
  params: Promise<{ orgId: string }>;
}

export async function generateMetadata({ params }: AccountingPageProps) {
  const { orgId } = await params;
  return {
    title: "Accounting Integrations | CarbonSite",
    description: "Connect Xero, QuickBooks, or Sage to automatically sync invoices and calculate Scope 3 emissions",
  };
}

export default async function AccountingPage({ params }: AccountingPageProps) {
  const { orgId } = await params;

  const user = await requireOrgMember(orgId, "admin", "editor");

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { name: true },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Link href={`/orgs/${orgId}/integrations`} className="flex items-center gap-2 text-amber-400 hover:text-amber-300 mb-4">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Integrations</span>
          </Link>
          <div className="mb-2 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400 uppercase tracking-widest">Accounting Software</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Connect Your Accounting Platform</h1>
          <p className="text-slate-400">
            Sync invoices and expenses to automatically calculate Scope 3 emissions from supplier spend.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8">
          {/* Xero Section */}
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                Xero
              </h2>
              <p className="text-slate-400">Cloud accounting platform — fully integrated for invoice sync and Scope 3 calculation</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Xero Status Card */}
              <Card className="border-slate-700 bg-slate-800/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white">Xero</CardTitle>
                      <CardDescription>Cloud accounting for small businesses</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
                      Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-300">
                    Automatically sync vendor invoices and bills to calculate Scope 3 emissions from supplier spend.
                  </p>
                  <XeroConnectButton orgId={orgId} />
                  <p className="text-xs text-slate-400">
                    Secure OAuth login. We never store your Xero password.
                  </p>
                </CardContent>
              </Card>

              {/* Feature Cards */}
              <Card className="border-slate-700 bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-400" />
                    Automatic Sync
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300">
                    Invoices sync automatically twice daily. No manual data entry needed.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-700 bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Lock className="h-5 w-5 text-amber-400" />
                    Enterprise Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300">
                    OAuth 2.0 authentication. Encrypted data at rest and in transit.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-700 bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <RotateCw className="h-5 w-5 text-amber-400" />
                    Recalculate Anytime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300">
                    Re-run calculations with updated invoices or factors anytime.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Xero Workflow */}
            <div className="mt-8 p-6 border border-slate-700 rounded-lg bg-slate-800/30">
              <h3 className="text-lg font-semibold text-white mb-6">How Xero Integration Works</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-semibold text-sm flex-shrink-0">1</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Invoice Sync</h4>
                    <p className="text-sm text-slate-300">We pull vendor invoices, bills, and expenses from your Xero account. Data syncs automatically twice daily.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-semibold text-sm flex-shrink-0">2</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Anomaly Detection</h4>
                    <p className="text-sm text-slate-300">Duplicate invoices, price spikes, and missing receipts are flagged for review before they enter your calculations.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-semibold text-sm flex-shrink-0">3</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Scope 3 Calculation</h4>
                    <p className="text-sm text-slate-300">Spend amounts are automatically mapped to emission categories and converted to tonnes CO₂e.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-semibold text-sm flex-shrink-0">4</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Immutable Audit Trail</h4>
                    <p className="text-sm text-slate-300">Every invoice and sync event is logged. Show auditors which invoices contributed to your emissions total.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* QuickBooks Section */}
          <div className="border-t border-slate-800 pt-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-slate-500" />
                QuickBooks
              </h2>
              <p className="text-slate-400">Coming soon — QuickBooks Online and QuickBooks Desktop support</p>
            </div>

            <Link href={`/orgs/${orgId}/integrations/accounting/quickbooks`}>
              <Card className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/80 transition-all cursor-pointer">
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
          </div>

          {/* Sage Section */}
          <div className="border-t border-slate-800 pt-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-slate-500" />
                Sage
              </h2>
              <p className="text-slate-400">Coming soon — Sage 50 and Sage Intacct support</p>
            </div>

            <Link href={`/orgs/${orgId}/integrations/accounting/sage`}>
              <Card className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/80 transition-all cursor-pointer">
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
      </div>
    </div>
  );
}
