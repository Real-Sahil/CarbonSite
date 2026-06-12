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
  Building2,
  Inbox,
  LogOut,
  ChevronDown,
  ScrollText,
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
import type { OrgRole } from "@prisma/client";

interface NavItem {
  label: string;
  href: string;
  icon: ElementType;
  roles: OrgRole[];
}

interface OrgSidebarProps {
  orgId: string;
  orgName: string;
  user: {
    name?: string | null;
    email: string;
  };
  role: OrgRole;
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

function canAccess(roles: readonly OrgRole[], role: OrgRole) {
  return roles.includes(role);
}

export function OrgSidebar({ orgId, orgName, user, role }: OrgSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    {
      label: "Dashboard",
      href: `/orgs/${orgId}/dashboard`,
      icon: LayoutDashboard,
      roles: ["admin", "editor", "reviewer", "viewer", "auditor"],
    },
    {
      label: "Submissions",
      href: `/orgs/${orgId}/submissions`,
      icon: Inbox,
      roles: ["admin", "editor", "reviewer"],
    },
    {
      label: "Records",
      href: `/orgs/${orgId}/records`,
      icon: FileText,
      roles: ["admin", "editor", "reviewer", "viewer", "auditor"],
    },
    {
      label: "Imports",
      href: `/orgs/${orgId}/imports`,
      icon: Upload,
      roles: ["admin", "editor", "reviewer", "viewer", "auditor"],
    },
    {
      label: "Reports",
      href: `/orgs/${orgId}/reports`,
      icon: BarChart2,
      roles: ["admin", "editor", "reviewer", "viewer", "auditor"],
    },
    {
      label: "Targets",
      href: `/orgs/${orgId}/targets`,
      icon: Target,
      roles: ["admin", "editor", "reviewer", "viewer", "auditor"],
    },
    {
      label: "Audit",
      href: `/orgs/${orgId}/audit`,
      icon: ScrollText,
      roles: ["admin", "editor", "reviewer", "viewer", "auditor"],
    },
    {
      label: "Setup",
      href: `/orgs/${orgId}/settings/operations`,
      icon: Building2,
      roles: ["admin", "editor"],
    },
    {
      label: "Settings",
      href: `/orgs/${orgId}/settings/members`,
      icon: Settings,
      roles: ["admin"],
    },
  ] satisfies NavItem[];

  const visibleNavItems = navItems.filter((item) => canAccess(item.roles, role));

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 border-b border-[#e5e7eb] bg-[#fffefc] md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <span
              className="block text-base tracking-[-0.48px] text-[#0f3e17]"
              style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
            >
              CarbonSite
            </span>
            <span className="block truncate text-xs text-[#222222] tracking-[-0.36px]" title={orgName}>
              {orgName}
            </span>
          </div>
          <UserMenu user={user} orgId={orgId} role={role} onSignOut={handleSignOut} compact />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3" aria-label="Organisation navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-[7px] px-3 text-sm font-normal tracking-[-0.42px] transition-colors",
                  isActive
                    ? "bg-[#e1f4df] text-[#0f3e17]"
                    : "text-[#222222] hover:bg-[#e1f4df] hover:text-[#0f3e17]"
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-[#0f3e17]" : "text-[#333333]"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden min-h-screen w-60 shrink-0 flex-col border-r border-[#e5e7eb] bg-[#fffefc] md:flex">
        <div className="border-b border-[#e5e7eb] px-5 pb-4 pt-6">
          <span
            className="block text-base tracking-[-0.48px] text-[#0f3e17]"
            style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
          >
            CarbonSite
          </span>
          <span
            className="mt-1 block truncate text-xs text-[#222222] tracking-[-0.36px]"
            title={orgName}
          >
            {orgName}
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4" aria-label="Organisation navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-[7px] px-3 py-2 text-sm font-normal tracking-[-0.42px] transition-colors",
                  isActive
                    ? "bg-[#e1f4df] text-[#0f3e17]"
                    : "text-[#222222] hover:bg-[#e1f4df] hover:text-[#0f3e17]"
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-[#0f3e17]" : "text-[#333333]"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#e5e7eb] px-3 py-4">
          <UserMenu user={user} orgId={orgId} role={role} onSignOut={handleSignOut} />
        </div>
      </aside>
    </>
  );
}

function UserMenu({
  user,
  orgId,
  role,
  onSignOut,
  compact = false,
}: {
  user: OrgSidebarProps["user"];
  orgId: string;
  role: OrgRole;
  onSignOut: () => void;
  compact?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-3 rounded-[7px] text-left transition-colors hover:bg-[#e1f4df]",
            compact ? "px-2 py-1.5" : "w-full px-2 py-2"
          )}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={undefined} alt={user.name ?? user.email} />
            <AvatarFallback className="bg-[#b1dbb8] text-[#0f3e17] text-xs font-normal">
              {getInitials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          {!compact && (
            <div className="min-w-0 flex-1">
              {user.name && (
                <p className="truncate text-sm font-normal tracking-[-0.42px] text-black">
                  {user.name}
                </p>
              )}
              <p className="truncate text-xs text-[#222222] tracking-[-0.36px]">{user.email}</p>
            </div>
          )}
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[#333333]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={compact ? "bottom" : "top"} className="w-52 rounded-[14px] border-[#e5e7eb] bg-[#fffefc]">
        {(role === "admin" || role === "editor") && (
          <DropdownMenuItem asChild>
            <Link href={`/orgs/${orgId}/settings/operations`} className="rounded-[7px] text-[#222222] focus:bg-[#e1f4df] focus:text-[#0f3e17]">
              <Building2 aria-hidden="true" className="mr-2 h-4 w-4" />
              Operations setup
            </Link>
          </DropdownMenuItem>
        )}
        {role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href={`/orgs/${orgId}/settings/members`} className="rounded-[7px] text-[#222222] focus:bg-[#e1f4df] focus:text-[#0f3e17]">
              <Users aria-hidden="true" className="mr-2 h-4 w-4" />
              Members &amp; Settings
            </Link>
          </DropdownMenuItem>
        )}
        {(role === "admin" || role === "editor") && <DropdownMenuSeparator className="bg-[#e5e7eb]" />}
        <DropdownMenuItem
          className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 rounded-[7px]"
          onClick={onSignOut}
        >
          <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
