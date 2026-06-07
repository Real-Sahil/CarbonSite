"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  FileText,
  BarChart2,
  Target,
  Settings,
  Users,
  Inbox,
  LogOut,
  ChevronDown,
} from "lucide-react";
import type { ElementType } from "react";
import { authClient } from "@/lib/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: ElementType;
}

interface OrgSidebarProps {
  orgId: string;
  orgName: string;
  user: {
    name?: string | null;
    email: string;
  };
}

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
}

export function OrgSidebar({ orgId, orgName, user }: OrgSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: `/orgs/${orgId}/dashboard`,
      icon: LayoutDashboard,
    },
    {
      label: "Submissions",
      href: `/orgs/${orgId}/submissions`,
      icon: Inbox,
    },
    {
      label: "Records",
      href: `/orgs/${orgId}/records`,
      icon: FileText,
    },
    {
      label: "Imports",
      href: `/orgs/${orgId}/imports`,
      icon: Upload,
    },
    {
      label: "Reports",
      href: `/orgs/${orgId}/reports`,
      icon: BarChart2,
    },
    {
      label: "Targets",
      href: `/orgs/${orgId}/targets`,
      icon: Target,
    },
    {
      label: "Settings",
      href: `/orgs/${orgId}/settings/members`,
      icon: Settings,
    },
  ];

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <span className="block text-base font-bold tracking-tight text-green-700">
              CarbonSite
            </span>
            <span className="block truncate text-xs font-medium text-slate-500" title={orgName}>
              {orgName}
            </span>
          </div>
          <UserMenu user={user} orgId={orgId} onSignOut={handleSignOut} compact />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-green-50 text-green-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-green-700" : "text-slate-400"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <aside className="hidden min-h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-5 pb-4 pt-6">
          <span className="block text-lg font-bold tracking-tight text-green-700">
            CarbonSite
          </span>
          <span
            className="mt-1 block truncate text-sm font-medium text-slate-600"
            title={orgName}
          >
            {orgName}
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-green-50 text-green-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-green-700" : "text-slate-400"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 px-3 py-4">
          <UserMenu user={user} orgId={orgId} onSignOut={handleSignOut} />
        </div>
      </aside>
    </>
  );
}

function UserMenu({
  user,
  orgId,
  onSignOut,
  compact = false,
}: {
  user: OrgSidebarProps["user"];
  orgId: string;
  onSignOut: () => void;
  compact?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-3 rounded-md text-left transition-colors hover:bg-slate-50",
            compact ? "px-2 py-1.5" : "w-full px-2 py-2"
          )}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={undefined} alt={user.name ?? user.email} />
            <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
          </Avatar>
          {!compact && (
            <div className="min-w-0 flex-1">
              {user.name && (
                <p className="truncate text-sm font-medium text-slate-900">
                  {user.name}
                </p>
              )}
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={compact ? "bottom" : "top"} className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/orgs/${orgId}/settings/members`}>
            <Users className="mr-2 h-4 w-4" />
            Members &amp; Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
          onClick={onSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
