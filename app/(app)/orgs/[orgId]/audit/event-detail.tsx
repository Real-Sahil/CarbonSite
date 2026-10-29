"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type EventDetailProps = {
  time: string;
  action: string;
  actor: string;
  resourceType: string;
  resourceId: string;
  chain: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: string;
};

/** Full-width view of one audit event: every stored field, with the metadata at its natural height. */
export function EventDetail(p: EventDetailProps) {
  const rows: [string, string | null][] = [
    ["Time", p.time],
    ["Actor", p.actor],
    ["Resource", `${p.resourceType} ${p.resourceId}`],
    ["Chain", p.chain],
    ["IP address", p.ipAddress],
    ["Browser", p.userAgent],
  ];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">View</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{p.action}</DialogTitle>
          <DialogDescription>Stored audit entry. Entries are append-only.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-[#5B6A78]">{k}</dt>
              <dd className="break-all text-[#131d29]">{v}</dd>
            </div>
          ))}
        </dl>
        <pre className="overflow-auto rounded-md border border-[#E3E8EE] bg-[#F9FAFC] p-3 text-xs leading-5 text-[#41505F]">{p.metadata}</pre>
      </DialogContent>
    </Dialog>
  );
}
