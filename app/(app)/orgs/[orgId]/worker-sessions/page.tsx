export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, MapPin, AlertTriangle } from "lucide-react";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function WorkerSessionsPage({ params }: PageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <div className="p-8 text-sm text-red-600">Access denied.</div>;
    }
    return <div className="p-8 text-sm text-red-600">Failed to load page. Try refreshing.</div>;
  }

  const [active, recent] = await Promise.all([
    prisma.workerSession.findMany({
      where: { organizationId: orgId, endedAt: null },
      orderBy: { startedAt: "desc" },
      take: 50,
      select: {
        id: true, startedAt: true, lastPingAt: true,
        lastPingLat: true, lastPingLng: true, overdueAlert: true, deviceInfo: true,
        user: { select: { id: true, name: true, email: true } },
        project: { select: { name: true } },
        site: { select: { name: true } },
      },
    }),
    prisma.workerSession.findMany({
      where: { organizationId: orgId, endedAt: { not: null } },
      orderBy: { endedAt: "desc" },
      take: 25,
      select: {
        id: true, startedAt: true, endedAt: true, lastPingAt: true,
        user: { select: { name: true } },
        project: { select: { name: true } },
        site: { select: { name: true } },
      },
    }),
  ]);

  const overdueCount = active.filter((s) => s.overdueAlert).length;

  function duration(start: Date, end?: Date | null) {
    const ms = (end ?? new Date()).getTime() - start.getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function lastSeen(d: Date | null) {
    if (!d) return "never";
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 2) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Worker Check-ins</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor active field worker sessions and location pings.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Sessions</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{active.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Overdue Alerts</CardTitle></CardHeader>
          <CardContent><div className={`text-2xl font-bold ${overdueCount > 0 ? "text-red-600" : ""}`}>{overdueCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Completed Today</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recent.filter((s) => s.endedAt && new Date(s.endedAt).toDateString() === new Date().toDateString()).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold">Active Now</h2>
        {active.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No active worker sessions.</div>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium">Worker</th>
                  <th className="px-4 py-3 text-left font-medium">Project / Site</th>
                  <th className="px-4 py-3 text-left font-medium">Started</th>
                  <th className="px-4 py-3 text-left font-medium">Duration</th>
                  <th className="px-4 py-3 text-left font-medium">Last Ping</th>
                  <th className="px-4 py-3 text-left font-medium">Location</th>
                  <th className="px-4 py-3 text-left font-medium">Alert</th>
                </tr>
              </thead>
              <tbody>
                {active.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.user.name ?? s.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.project?.name ?? s.site?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3">{new Date(s.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-3 font-mono text-xs">{duration(s.startedAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {lastSeen(s.lastPingAt)}
                    </td>
                    <td className="px-4 py-3">
                      {s.lastPingLat && s.lastPingLng ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {Number(s.lastPingLat).toFixed(4)}, {Number(s.lastPingLng).toFixed(4)}
                        </span>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      {s.overdueAlert ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Overdue
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Recent Completed</h2>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium">Worker</th>
                  <th className="px-4 py-3 text-left font-medium">Project / Site</th>
                  <th className="px-4 py-3 text-left font-medium">Started</th>
                  <th className="px-4 py-3 text-left font-medium">Ended</th>
                  <th className="px-4 py-3 text-left font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{s.user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.project?.name ?? s.site?.name ?? "-"}</td>
                    <td className="px-4 py-3">{new Date(s.startedAt).toLocaleDateString("en-GB")} {new Date(s.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-3">{s.endedAt ? new Date(s.endedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{duration(s.startedAt, s.endedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
