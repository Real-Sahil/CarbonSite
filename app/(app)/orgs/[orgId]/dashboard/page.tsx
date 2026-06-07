import Link from "next/link";
import { BarChart2, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DashboardPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { orgId } = await params;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Your organisation&apos;s GHG emissions overview.
        </p>
      </div>

      <Card className="border-green-100 bg-green-50/40">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <BarChart2 className="h-5 w-5 text-green-700" />
            </div>
            <CardTitle className="text-lg">Coming in Milestone 3</CardTitle>
          </div>
          <CardDescription className="text-slate-600 text-sm leading-relaxed">
            Calculation results and aggregates will appear here once you have
            imported activity records and run a calculation. You will see
            real-time Scope 1, 2, and 3 breakdowns, period comparisons, and
            progress toward your reduction targets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {["Scope 1", "Scope 2", "Scope 3"].map((scope) => (
              <div
                key={scope}
                className="rounded-lg border border-green-200 bg-white p-4"
              >
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                  {scope}
                </p>
                <div className="h-7 w-24 rounded bg-slate-100 animate-pulse" />
                <p className="text-xs text-slate-400 mt-1">tCO2e</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="default" size="sm">
              <Link href={`/orgs/${orgId}/submissions`}>
                Review field submissions
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/orgs/${orgId}/imports`}>Import activity data</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6 mt-6">
        {[
          {
            title: "Activity Records",
            description: "Committed emissions data awaiting calculation.",
            href: `/orgs/${orgId}/records`,
          },
          {
            title: "Reports",
            description: "Published snapshots and audit-ready PDF reports.",
            href: `/orgs/${orgId}/reports`,
          },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="group block">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
