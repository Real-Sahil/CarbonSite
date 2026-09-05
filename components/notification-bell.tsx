"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  resourceId: string | null;
  read: boolean;
  createdAt: string;
}

const POLL_MS = 45_000;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotificationBell({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);

  const base = `/api/orgs/${orgId}/notifications`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(base, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!mounted.current) return;
      setItems(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
      setLoaded(true);
    } catch {
      /* transient — next poll retries */
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [base]);

  // Lightweight unread-count poll: fetches the same endpoint but only keeps the
  // count when the panel is closed, so the badge stays live without churn.
  const pollCount = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (mounted.current) setUnread(data.unreadCount ?? 0);
    } catch {
      /* ignore */
    }
  }, [base]);

  useEffect(() => {
    mounted.current = true;
    pollCount();
    const id = setInterval(pollCount, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [pollCount]);

  useEffect(() => {
    if (open && !loaded) load();
  }, [open, loaded, load]);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnread((prev) => Math.max(0, prev - ids.length));
    try {
      await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch {
      /* optimistic — a later poll reconciles */
    }
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    } catch {
      /* ignore */
    }
  }

  function onItemClick(n: NotificationItem) {
    if (!n.read) markRead([n.id]);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  const badge = unread > 9 ? "9+" : String(unread);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
          className="relative grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 transition-colors"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 h-4 place-items-center rounded-full bg-amber-500 px-1 text-[9px] font-semibold leading-none text-white shadow-[0_0_8px_rgba(245,158,11,0.6)]">
              {badge}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 overflow-hidden"
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:text-amber-700 focus:outline-none"
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-2 text-xs text-slate-500">You&apos;re all caught up.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onItemClick(n)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50 transition-colors",
                      !n.read && "bg-amber-50/50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      )}
                      <div className={cn("min-w-0 flex-1", n.read && "pl-3.5")}>
                        <p className="text-xs font-medium text-slate-800 truncate">{n.title}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-2">{n.body}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{relativeTime(n.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
