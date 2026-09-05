export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { XeroConnectButton } from "@/components/integrations/xero-connect-button";
import { QuickBooksConnectButton } from "@/components/integrations/quickbooks-connect-button";
import { SageConnectButton } from "@/components/integrations/sage-connect-button";
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

  await requireOrgMember(orgId, "admin", "editor");

  const connections = await prisma.integrationConnection.findMany({
    where: { organizationId: orgId, provider: { in: ["xero", "quickbooks", "sage"] } },
    select: { provider: true },
  });
  const connectedProviders = new Set(connections.map((c) => c.provider));
  const xeroConnected = connectedProviders.has("xero");
  const quickbooksConnected = connectedProviders.has("quickbooks");
  const sageConnected = connectedProviders.has("sage");

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Link href={`/orgs/${orgId}/integrations`} className="flex items-center gap-2 text-[#f97316] hover:text-orange-600 mb-4">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Integrations</span>
          </Link>
          <div className="mb-2 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#f97316]" />
            <span className="text-sm font-semibold text-[#f97316] uppercase tracking-widest">Accounting Software</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Connect Your Accounting Platform</h1>
          <p className="text-slate-500">
            Sync invoices and expenses to automatically calculate Scope 3 emissions from supplier spend.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8">
          {/* Xero Section */}
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Xero
              </h2>
              <p className="text-slate-500">Cloud accounting platform, fully integrated for invoice sync and Scope 3 calculation</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Xero Status Card */}
              <Card className="border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-slate-900">Xero</CardTitle>
                      <CardDescription>Cloud accounting for small businesses</CardDescription>
                    </div>
                    {xeroConnected ? (
                      <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-200 text-slate-500 bg-slate-50">
                        Not connected
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Automatically sync vendor invoices and bills to calculate Scope 3 emissions from supplier spend.
                  </p>
                  <XeroConnectButton orgId={orgId} connected={xeroConnected} />
                  <p className="text-xs text-slate-500">
                    Secure OAuth login. We never store your Xero password.
                  </p>
                </CardContent>
              </Card>

              {/* Feature Cards */}
              <Card className="border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-slate-900 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-[#f97316]" />
                    Automatic Sync
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Invoices sync automatically twice daily. No manual data entry needed.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-slate-900 flex items-center gap-2">
                    <Lock className="h-5 w-5 text-[#f97316]" />
                    Enterprise Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    OAuth 2.0 authentication. Encrypted data at rest and in transit.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-slate-900 flex items-center gap-2">
                    <RotateCw className="h-5 w-5 text-[#f97316]" />
                    Recalculate Anytime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Re-run calculations with updated invoices or factors anytime.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Xero Workflow */}
            <div className="mt-8 p-6 border border-[#E5E7EB] rounded-lg bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">How Xero Integration Works</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7ed] text-[#f97316] font-semibold text-sm flex-shrink-0">1</div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Invoice Sync</h4>
                    <p className="text-sm text-slate-600">We pull vendor invoices, bills, and expenses from your Xero account. Data syncs automatically twice daily.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7ed] text-[#f97316] font-semibold text-sm flex-shrink-0">2</div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Anomaly Detection</h4>
                    <p className="text-sm text-slate-600">Duplicate invoices, price spikes, and missing receipts are flagged for review before they enter your calculations.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7ed] text-[#f97316] font-semibold text-sm flex-shrink-0">3</div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Scope 3 Calculation</h4>
                    <p className="text-sm text-slate-600">Spend amounts are automatically mapped to emission categories and converted to tonnes CO₂e.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7ed] text-[#f97316] font-semibold text-sm flex-shrink-0">4</div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Immutable Audit Trail</h4>
                    <p className="text-sm text-slate-600">Every invoice and sync event is logged. Show auditors which invoices contributed to your emissions total.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* QuickBooks Section */}
          <div className="border-t border-[#E5E7EB] pt-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                QuickBooks
              </h2>
              <p className="text-slate-500">Cloud accounting software, fully integrated for invoice sync and Scope 3 calculation</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* QuickBooks Status Card */}
              <Card className="border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-slate-900">QuickBooks</CardTitle>
                      <CardDescription>Online accounting software</CardDescription>
                    </div>
                    {quickbooksConnected ? (
                      <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-200 text-slate-500 bg-slate-50">
                        Not connected
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Automatically sync vendor invoices and bills to calculate Scope 3 emissions from supplier spend.
                  </p>
                  <QuickBooksConnectButton orgId={orgId} connected={quickbooksConnected} />
                  <p className="text-xs text-slate-500">
                    Secure OAuth login. We never store your QuickBooks password.
                  </p>
                </CardContent>
              </Card>

              {/* Feature Cards */}
              <Card className="border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-slate-900 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-blue-600" />
                    Automatic Sync
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Invoices sync automatically twice daily. No manual data entry needed.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-slate-900 flex items-center gap-2">
                    <Lock className="h-5 w-5 text-blue-600" />
                    Enterprise Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    OAuth 2.0 authentication. Encrypted data at rest and in transit.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-slate-900 flex items-center gap-2">
                    <RotateCw className="h-5 w-5 text-blue-600" />
                    Recalculate Anytime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Re-run calculations with updated invoices or factors anytime.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sage Section */}
          <div className="border-t border-[#E5E7EB] pt-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Sage
              </h2>
              <p className="text-slate-500">ERP and accounting software, fully integrated for invoice sync and Scope 3 calculation</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Sage Status Card */}
              <Card className="border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-slate-900">Sage</CardTitle>
                      <CardDescription>ERP and accounting software</CardDescription>
                    </div>
                    {sageConnected ? (
                      <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-200 text-slate-500 bg-slate-50">
                        Not connected
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Automatically sync vendor invoices and bills to calculate Scope 3 emissions from supplier spend.
                  </p>
                  <SageConnectButton orgId={orgId} connected={sageConnected} />
                  <p className="text-xs text-slate-500">
                    Secure OAuth login. We never store your Sage password.
                  </p>
                </CardContent>
              </Card>

              {/* Feature Cards */}
              <Card className="border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-slate-900 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-600" />
                    Automatic Sync
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Invoices sync automatically twice daily. No manual data entry needed.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-slate-900 flex items-center gap-2">
                    <Lock className="h-5 w-5 text-purple-600" />
                    Enterprise Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    OAuth 2.0 authentication. Encrypted data at rest and in transit.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-slate-900 flex items-center gap-2">
                    <RotateCw className="h-5 w-5 text-purple-600" />
                    Recalculate Anytime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Re-run calculations with updated invoices or factors anytime.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
