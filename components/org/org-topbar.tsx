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
import { AppearanceMenu, ThemeToggle } from "@/components/org/appearance";
import type { ThemeChoice } from "@/lib/theme/preference";

interface OrgTopBarProps {
  orgId: string;
  user: { name?: string | null; email: string };
  themePreference?: ThemeChoice | null;
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
 * Desktop top bar: account menu, the light/dark toggle, then the notification bell, at the top right of every org page.
 * Mobile keeps its own header (bell) and drawer footer (account), so this bar is md and up only.
 */
export function OrgTopBar({ orgId, user, themePreference }: OrgTopBarProps) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <header className="sticky top-0 z-30 hidden md:flex h-14 shrink-0 items-center justify-end gap-2 border-b border-[#131d29]/[0.08] bg-[#F9FAFC]/90 px-6 backdrop-blur">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#F9FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E3E8EE]"
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={undefined} alt={user.name ?? user.email} />
              <AvatarFallback className="bg-[#fff7ed] text-[#c2400c] text-xs font-medium border border-[#fed7aa]">{initialsOf(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <span className="max-w-[200px] truncate text-xs font-medium text-[#41505F]">{user.name ?? user.email}</span>
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-[#5B6A78] shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-xl bg-white border-[#E3E8EE] shadow-lg">
          {user.name && (
            <>
              <DropdownMenuLabel className="font-normal">
                <p className="text-xs font-medium text-[#41505F] truncate">{user.name}</p>
                <p className="text-[11px] text-[#5B6A78] truncate">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#E3E8EE]" />
            </>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/orgs/${orgId}/settings/members`} className="rounded-lg text-[#41505F] focus:text-[#131d29] focus:bg-[#F9FAFC]">
              <Users aria-hidden="true" className="h-4 w-4 mr-2" />
              Members and settings
            </Link>
          </DropdownMenuItem>
          <AppearanceMenu saved={themePreference ?? null} />
          <DropdownMenuSeparator className="bg-[#E3E8EE]" />
          <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer rounded-lg" onClick={signOut}>
            <LogOut aria-hidden="true" className="h-4 w-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ThemeToggle />
      <NotificationBell orgId={orgId} />
    </header>
  );
}
