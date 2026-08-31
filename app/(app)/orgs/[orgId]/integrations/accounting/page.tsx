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
  ArrowLeft,
  ArrowRight,
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
        <div className="mb-12">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1">
              <Card className="border-slate-700 bg-slate-800/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white text-2xl">Xero</CardTitle>
                      <CardDescription>Cloud accounting for small businesses</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Fully Integrated</span>
                  </div>
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                    Connect Xero
                  </Button>
                  <p className="text-xs text-slate-400">
                    Secure OAuth login. We never store your Xero password.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2">
              <Card className="border-slate-700 bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="text-white">What happens when you connect?</CardTitle>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
