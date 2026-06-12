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
    <div className="p-[42px] max-w-[1200px] mx-auto">
      <div className="mb-[42px]">
        <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Overview
        </p>
        <h1
          className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          Dashboard
        </h1>
        <p className="text-sm text-[#222222] font-normal tracking-[-0.42px] mt-[7px]">
          Your organisation&apos;s GHG emissions overview.
        </p>
      </div>

      <Card className="border-[#b1dbb8] bg-[#e1f4df]">
        <CardHeader className="pb-[21px]">
          <div className="flex items-center gap-[14px] mb-[14px]">
            <div className="flex h-10 w-10 items-center justify-center rounded-[7px] bg-[#b1dbb8]">
              <BarChart2 aria-hidden="true" className="h-5 w-5 text-[#0f3e17]" />
            </div>
            <CardTitle className="text-lg">Coming in Milestone 3</CardTitle>
          </div>
          <CardDescription>
            Calculation results and aggregates will appear here once you have
            imported activity records and run a calculation. You will see
            real-time Scope 1, 2, and 3 breakdowns, period comparisons, and
            progress toward your reduction targets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-[21px] mb-[28px]">
            {["Scope 1", "Scope 2", "Scope 3"].map((scope) => (
              <div
                key={scope}
                className="rounded-[14px] border border-[#b1dbb8] bg-[#fffefc] p-[21px]"
              >
                <p className="text-xs font-normal text-[#0f3e17] uppercase tracking-wide mb-[7px]">
                  {scope}
                </p>
                <div className="h-7 w-24 rounded-[7px] bg-[#cfe7d3] animate-pulse" />
                <p className="text-xs text-[#222222] mt-[7px] tracking-[-0.36px]">tCO2e</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-[14px]">
            <Button asChild variant="default" size="sm">
              <Link href={`/orgs/${orgId}/submissions`}>
                Review field submissions
                <ArrowRight aria-hidden="true" className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/orgs/${orgId}/imports`}>Import activity data</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-[21px] mt-[28px]">
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
            <Card className="h-full transition-colors group-hover:border-[#b1dbb8] group-hover:bg-[#e1f4df]">
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
