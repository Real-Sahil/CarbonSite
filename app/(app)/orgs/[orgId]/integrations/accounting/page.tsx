export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgMember, ROLE_GROUPS, AuthError } from "@/lib/auth/session";
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

export async function generateMetadata() {
  return {
    title: "Accounting Integrations | MetricOra",
    description: "Connect Xero, QuickBooks, or Sage to automatically sync invoices and calculate Scope 3 emissions",
  };
}

export default async function AccountingPage({ params }: AccountingPageProps) {
  const { orgId } = await params;

  let authErr: AuthError | null = null;
  try {
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
  } catch (err) {
    if (err instanceof AuthError) { authErr = err; }
    else { return <div className="p-8"><p className="text-sm text-red-600">Failed to load page. The database may be updating — try refreshing in a moment.</p></div>; }
  }
  if (authErr) {
    if (authErr.status === 401) redirect("/sign-in");
    return <div className="p-8"><h1 className="text-lg text-[#131d29]">Access denied</h1><p className="mt-1 text-sm text-[#5B6A78]">Admin or editor access required.</p></div>;
  }

  const connections = await prisma.integrationConnection.findMany({
    where: { organizationId: orgId, provider: { in: ["xero", "quickbooks", "sage"] } },
    select: { provider: true },
  });
  const connectedProviders = new Set(connections.map((c) => c.provider));
  const xeroConnected = connectedProviders.has("xero");
  const quickbooksConnected = connectedProviders.has("quickbooks");
  const sageConnected = connectedProviders.has("sage");

  return (
    <div className="min-h-screen bg-[#F9FAFC]">
      <div className="border-b border-[#E3E8EE] bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Link href={`/orgs/${orgId}/integrations`} className="flex items-center gap-2 text-[#c2400c] hover:text-orange-600 mb-4">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Integrations</span>
          </Link>
          <div className="mb-2 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#c2400c]" />
            <span className="text-sm font-semibold text-[#c2400c] uppercase tracking-widest">Accounting Software</span>
          </div>
          <h1 className="text-3xl text-[#131d29] mb-2">Connect Your Accounting Platform</h1>
          <p className="text-[#5B6A78]">
            Sync invoices and expenses to automatically calculate Scope 3 emissions from supplier spend.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8">
          {/* Xero Section */}
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-[#131d29] flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Xero
              </h2>
              <p className="text-[#5B6A78]">Cloud accounting platform, fully integrated for invoice sync and Scope 3 calculation</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Xero Status Card */}
              <Card className="border-[#E3E8EE] bg-white shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-[#131d29]">Xero</CardTitle>
                      <CardDescription>Cloud accounting for small businesses</CardDescription>
                    </div>
                    {xeroConnected ? (
                      <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-[#E3E8EE] text-[#5B6A78] bg-[#F9FAFC]">
                        Not connected
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-[#41505F]">
                    Automatically sync vendor invoices and bills to calculate Scope 3 emissions from supplier spend.
                  </p>
                  <XeroConnectButton orgId={orgId} connected={xeroConnected} />
                  <p className="text-xs text-[#5B6A78]">
                    Secure OAuth login. We never store your Xero password.{" "}
                    <Link href={`/orgs/${orgId}/settings/integrations`} className="text-[#c2400c] hover:underline">
                      Use your own Xero app
                    </Link>
                  </p>
                </CardContent>
              </Card>

              {/* Feature Cards */}
              <Card className="border-[#E3E8EE] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[#131d29] flex items-center gap-2">
                    <Zap className="h-5 w-5 text-[#c2400c]" />
                    Automatic Sync
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#41505F]">
                    Invoices sync automatically twice daily. No manual data entry needed.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#E3E8EE] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[#131d29] flex items-center gap-2">
                    <Lock className="h-5 w-5 text-[#c2400c]" />
                    Enterprise Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#41505F]">
                    OAuth 2.0 authentication. Encrypted data at rest and in transit.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#E3E8EE] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[#131d29] flex items-center gap-2">
                    <RotateCw className="h-5 w-5 text-[#c2400c]" />
                    Recalculate Anytime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#41505F]">
                    Re-run calculations with updated invoices or factors anytime.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Xero Workflow */}
            <div className="mt-8 p-6 border border-[#E3E8EE] rounded-lg bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-[#131d29] mb-6">How Xero Integration Works</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7ed] text-[#c2400c] font-semibold text-sm flex-shrink-0">1</div>
                  <div>
                    <h4 className="font-semibold text-[#131d29] mb-1">Invoice Sync</h4>
                    <p className="text-sm text-[#41505F]">We pull vendor invoices, bills, and expenses from your Xero account. Data syncs automatically twice daily.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7ed] text-[#c2400c] font-semibold text-sm flex-shrink-0">2</div>
                  <div>
                    <h4 className="font-semibold text-[#131d29] mb-1">Anomaly Detection</h4>
                    <p className="text-sm text-[#41505F]">Duplicate invoices, price spikes, and missing receipts are flagged for review before they enter your calculations.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7ed] text-[#c2400c] font-semibold text-sm flex-shrink-0">3</div>
                  <div>
                    <h4 className="font-semibold text-[#131d29] mb-1">Scope 3 Calculation</h4>
                    <p className="text-sm text-[#41505F]">Spend amounts are automatically mapped to emission categories and converted to tonnes CO₂e.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7ed] text-[#c2400c] font-semibold text-sm flex-shrink-0">4</div>
                  <div>
                    <h4 className="font-semibold text-[#131d29] mb-1">Immutable Audit Trail</h4>
                    <p className="text-sm text-[#41505F]">Every invoice and sync event is logged. Show auditors which invoices contributed to your emissions total.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* QuickBooks Section */}
          <div className="border-t border-[#E3E8EE] pt-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-[#131d29] flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                QuickBooks
              </h2>
              <p className="text-[#5B6A78]">Cloud accounting software, fully integrated for invoice sync and Scope 3 calculation</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* QuickBooks Status Card */}
              <Card className="border-[#E3E8EE] bg-white shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-[#131d29]">QuickBooks</CardTitle>
                      <CardDescription>Online accounting software</CardDescription>
                    </div>
                    {quickbooksConnected ? (
                      <Badge variant="outline" className="border-[#E3E8EE] text-[#41505F] bg-[#F9FAFC]">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-[#E3E8EE] text-[#5B6A78] bg-[#F9FAFC]">
                        Not connected
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-[#41505F]">
                    Automatically sync vendor invoices and bills to calculate Scope 3 emissions from supplier spend.
                  </p>
                  <QuickBooksConnectButton orgId={orgId} connected={quickbooksConnected} />
                  <p className="text-xs text-[#5B6A78]">
                    Secure OAuth login. We never store your QuickBooks password.{" "}
                    <Link href={`/orgs/${orgId}/settings/integrations`} className="text-[#c2400c] hover:underline">
                      Use your own QuickBooks app
                    </Link>
                  </p>
                </CardContent>
              </Card>

              {/* Feature Cards */}
              <Card className="border-[#E3E8EE] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[#131d29] flex items-center gap-2">
                    <Zap className="h-5 w-5 text-[#c2400c]" />
                    Automatic Sync
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#41505F]">
                    Invoices sync automatically twice daily. No manual data entry needed.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#E3E8EE] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[#131d29] flex items-center gap-2">
                    <Lock className="h-5 w-5 text-[#c2400c]" />
                    Enterprise Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#41505F]">
                    OAuth 2.0 authentication. Encrypted data at rest and in transit.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#E3E8EE] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[#131d29] flex items-center gap-2">
                    <RotateCw className="h-5 w-5 text-[#c2400c]" />
                    Recalculate Anytime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#41505F]">
                    Re-run calculations with updated invoices or factors anytime.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sage Section */}
          <div className="border-t border-[#E3E8EE] pt-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-[#131d29] flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Sage
              </h2>
              <p className="text-[#5B6A78]">ERP and accounting software, fully integrated for invoice sync and Scope 3 calculation</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Sage Status Card */}
              <Card className="border-[#E3E8EE] bg-white shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-[#131d29]">Sage</CardTitle>
                      <CardDescription>ERP and accounting software</CardDescription>
                    </div>
                    {sageConnected ? (
                      <Badge variant="outline" className="border-[#E3E8EE] text-[#41505F] bg-[#F9FAFC]">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-[#E3E8EE] text-[#5B6A78] bg-[#F9FAFC]">
                        Not connected
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-[#41505F]">
                    Automatically sync vendor invoices and bills to calculate Scope 3 emissions from supplier spend.
                  </p>
                  <SageConnectButton orgId={orgId} connected={sageConnected} />
                  <p className="text-xs text-[#5B6A78]">
                    Secure OAuth login. We never store your Sage password.{" "}
                    <Link href={`/orgs/${orgId}/settings/integrations`} className="text-[#c2400c] hover:underline">
                      Use your own Sage app
                    </Link>
                  </p>
                </CardContent>
              </Card>

              {/* Feature Cards */}
              <Card className="border-[#E3E8EE] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[#131d29] flex items-center gap-2">
                    <Zap className="h-5 w-5 text-[#c2400c]" />
                    Automatic Sync
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#41505F]">
                    Invoices sync automatically twice daily. No manual data entry needed.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#E3E8EE] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[#131d29] flex items-center gap-2">
                    <Lock className="h-5 w-5 text-[#c2400c]" />
                    Enterprise Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#41505F]">
                    OAuth 2.0 authentication. Encrypted data at rest and in transit.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#E3E8EE] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[#131d29] flex items-center gap-2">
                    <RotateCw className="h-5 w-5 text-[#c2400c]" />
                    Recalculate Anytime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#41505F]">
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
