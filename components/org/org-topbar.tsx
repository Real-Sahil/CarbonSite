"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Users } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notification-bell";

interface OrgTopBarProps {
  orgId: string;
  user: { name?: string | null; email: string };
}

function initialsOf(name?: string | null, email?: string): string {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
}

/**
 * Desktop top bar: account menu, then the notification bell, at the top right of every org page.
 * Mobile keeps its own header (bell) and drawer footer (account), so this bar is md and up only.
 */
export function OrgTopBar({ orgId, user }: OrgTopBarProps) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <header className="sticky top-0 z-30 hidden md:flex h-14 shrink-0 items-center justify-end gap-2 border-b border-slate-200 bg-white px-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={undefined} alt={user.name ?? user.email} />
              <AvatarFallback className="bg-[#fff7ed] text-[#c2410c] text-xs font-medium border border-[#fed7aa]">{initialsOf(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <span className="max-w-[200px] truncate text-xs font-medium text-slate-700">{user.name ?? user.email}</span>
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-xl bg-white border-slate-200 shadow-lg">
          {user.name && (
            <>
              <DropdownMenuLabel className="font-normal">
                <p className="text-xs font-medium text-slate-700 truncate">{user.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-200" />
            </>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/orgs/${orgId}/settings/members`} className="rounded-lg text-slate-600 focus:text-slate-900 focus:bg-slate-100">
              <Users aria-hidden="true" className="h-4 w-4 mr-2" />
              Members and settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-200" />
          <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer rounded-lg" onClick={signOut}>
            <LogOut aria-hidden="true" className="h-4 w-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NotificationBell orgId={orgId} />
    </header>
  );
}
