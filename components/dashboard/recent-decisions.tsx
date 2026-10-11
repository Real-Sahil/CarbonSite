import Link from "next/link";
import { Clock, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { decisionSentence } from "@/lib/dashboard/decisions";

export type RecentDecision = {
  id: string;
  action: string;
  createdAt: Date;
  actor: { name: string | null; email: string } | null;
};

/**
 * The last few audit events as plain sentences: what was done, by whom, when.
 * Rows come from the audit log the dashboard already reads; nothing is added here.
 */
export function RecentDecisions({
  orgId,
  decisions,
  locale,
  canOpenAudit,
}: {
  orgId: string;
  decisions: RecentDecision[];
  locale: string;
  canOpenAudit: boolean;
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Recent decisions</CardTitle>
            <CardDescription>What people in this organisation have recorded, approved or published.</CardDescription>
          </div>
          {canOpenAudit && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/orgs/${orgId}/audit`}>
                <ListChecks className="h-4 w-4" />
                Full audit trail
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {decisions.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No decisions recorded yet"
            description="Publishing a snapshot, approving a plan or reviewing records appears here."
          />
        ) : (
          <ul className="divide-y divide-[#e5e7eb] rounded-[14px] border border-[#E5E7EB]">
            {decisions.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-4 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-normal text-[#111827] tracking-[-0.42px]">{decisionSentence(d.action)}</p>
                  <p className="mt-0.5 text-xs text-[#374151] tracking-[-0.36px]">
                    {d.actor?.name ?? d.actor?.email ?? "System"}
                  </p>
                </div>
                <time dateTime={d.createdAt.toISOString()} className="shrink-0 text-xs text-[#374151] tracking-[-0.36px]">
                  {d.createdAt.toLocaleDateString(locale, { day: "numeric", month: "short" })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
