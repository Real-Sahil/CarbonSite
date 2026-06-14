"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Upload,
  FileText,
  BarChart2,
  Calculator,
  Target,
  Settings,
  Users,
  Inbox,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Heart,
  Clock,
  Menu,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface OrgSidebarProps {
  orgId: string;
  orgName: string;
  user: {
    name?: string | null;
    email: string;
  };
}

const COLLAPSED_KEY = "carbonsite:sidebar:collapsed";

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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const navItems: NavItem[] = [
    { label: "Dashboard",    href: `/orgs/${orgId}/dashboard`,       icon: LayoutDashboard },
    { label: "Submissions",  href: `/orgs/${orgId}/submissions`,      icon: Inbox },
    { label: "Records",      href: `/orgs/${orgId}/records`,          icon: FileText },
    { label: "Imports",      href: `/orgs/${orgId}/imports`,          icon: Upload },
    { label: "Calculations", href: `/orgs/${orgId}/calculations`,     icon: Calculator },
    { label: "Reports",      href: `/orgs/${orgId}/reports`,          icon: BarChart2 },
    { label: "Targets",      href: `/orgs/${orgId}/targets`,          icon: Target },
    { label: "Contracts",    href: `/orgs/${orgId}/contracts`,         icon: Briefcase },
    { label: "Social Value", href: `/orgs/${orgId}/social-value`,      icon: Heart },
    { label: "Audit",        href: `/orgs/${orgId}/audit`,             icon: Clock },
    { label: "Settings",     href: `/orgs/${orgId}/settings/members`, icon: Settings },
  ];

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  function handleMobileNavClick() {
    setMobileOpen(false);
  }

  return (
    <TooltipProvider delayDuration={200}>
      {/* ── Mobile top bar ────────────────────────────────────────────────── */}
      <header className="flex md:hidden sticky top-0 z-30 items-center h-14 px-4 bg-[#fffefc] border-b border-[#e5e7eb] shrink-0">
        <button
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="flex items-center justify-center h-9 w-9 rounded-[7px] hover:bg-[#e1f4df] transition-colors"
        >
          <Menu className="h-5 w-5 text-[#0f3e17]" aria-hidden="true" />
        </button>
        <span
          className="ml-3 text-base font-light tracking-[-0.48px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          CarbonSite
        </span>
        <span className="ml-2 text-xs text-[#555] truncate max-w-[140px]">/ {orgName}</span>
      </header>

      {/* ── Mobile drawer overlay ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#fffefc] shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[#e5e7eb]">
              <div className="min-w-0">
                <span
                  className="block text-base font-light tracking-[-0.48px] text-[#0f3e17]"
                  style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
                >
                  CarbonSite
                </span>
                <span className="text-xs text-[#222222] font-normal mt-1 block truncate tracking-[-0.36px]">
                  {orgName}
                </span>
              </div>
              <button
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center h-8 w-8 rounded-[7px] hover:bg-[#e1f4df] transition-colors ml-2 shrink-0"
              >
                <X className="h-4 w-4 text-[#0f3e17]" aria-hidden="true" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5 overflow-y-auto" aria-label="Organisation navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleMobileNavClick}
                    className={cn(
                      "flex items-center gap-3 rounded-[7px] px-3 py-2.5 text-sm font-normal tracking-[-0.42px] transition-colors",
                      isActive
                        ? "bg-[#e1f4df] text-[#0f3e17]"
                        : "text-[#222222] hover:bg-[#e1f4df] hover:text-[#0f3e17]",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn("h-4 w-4 shrink-0", isActive ? "text-[#0f3e17]" : "text-[#333333]")}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User footer */}
            <div className="border-t border-[#e5e7eb] px-2 py-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 w-full px-2 py-2 rounded-[7px] hover:bg-[#e1f4df] transition-colors text-left">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={undefined} alt={user.name ?? user.email} />
                      <AvatarFallback className="bg-[#b1dbb8] text-[#0f3e17] text-xs font-normal">
                        {getInitials(user.name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      {user.name && (
                        <p className="text-sm font-normal tracking-[-0.42px] text-black truncate">{user.name}</p>
                      )}
                      <p className="text-xs text-[#222222] tracking-[-0.36px] truncate">{user.email}</p>
                    </div>
                    <ChevronDown aria-hidden="true" className="h-4 w-4 text-[#333333] shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-52 rounded-[14px] border-[#e5e7eb] bg-[#fffefc]">
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/orgs/${orgId}/settings/members`}
                      onClick={handleMobileNavClick}
                      className="rounded-[7px] text-[#222222] focus:bg-[#e1f4df] focus:text-[#0f3e17]"
                    >
                      <Users aria-hidden="true" className="h-4 w-4 mr-2" />
                      Members &amp; Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#e5e7eb]" />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer rounded-[7px]"
                    onClick={handleSignOut}
                  >
                    <LogOut aria-hidden="true" className="h-4 w-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ───────────────────────────────────────────────── */}
      <aside
        className={cn(
          "relative hidden md:flex flex-col min-h-screen bg-[#fffefc] border-r border-[#e5e7eb] shrink-0 transition-[width] duration-200",
          collapsed ? "w-[60px]" : "w-60",
        )}
      >
        {/* Logo + Org */}
        <div
          className={cn(
            "flex items-center border-b border-[#e5e7eb] overflow-hidden",
            collapsed ? "px-3 pt-5 pb-4 justify-center" : "px-5 pt-6 pb-4",
          )}
        >
          {collapsed ? (
            <span
              className="text-[#0f3e17] font-light text-lg select-none"
              style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)" }}
              title={orgName}
            >
              C
            </span>
          ) : (
            <div className="min-w-0">
              <span
                className="block text-base font-light tracking-[-0.48px] text-[#0f3e17]"
                style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
              >
                CarbonSite
              </span>
              <span
                className="text-xs text-[#222222] font-normal mt-1 block truncate tracking-[-0.36px]"
                title={orgName}
              >
                {orgName}
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav
          className="flex-1 px-2 py-4 flex flex-col gap-0.5 overflow-hidden"
          aria-label="Organisation navigation"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-[7px] text-sm font-normal tracking-[-0.42px] transition-colors",
                  collapsed ? "px-0 py-2 justify-center" : "px-3 py-2",
                  isActive
                    ? "bg-[#e1f4df] text-[#0f3e17]"
                    : "text-[#222222] hover:bg-[#e1f4df] hover:text-[#0f3e17]",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-[#0f3e17]" : "text-[#333333]",
                  )}
                />
                {!collapsed && item.label}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return link;
          })}
        </nav>

        {/* User footer */}
        <div className={cn("border-t border-[#e5e7eb] px-2 py-3", collapsed && "flex justify-center")}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex items-center justify-center w-9 h-9 rounded-[7px] hover:bg-[#e1f4df] transition-colors"
                  onClick={handleSignOut}
                  title="Sign out"
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={undefined} alt={user.name ?? user.email} />
                    <AvatarFallback className="bg-[#b1dbb8] text-[#0f3e17] text-[10px] font-normal">
                      {getInitials(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {user.name ?? user.email}
                <br />
                <span className="text-zinc-400">Click to sign out</span>
              </TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full px-2 py-2 rounded-[7px] hover:bg-[#e1f4df] transition-colors text-left">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={undefined} alt={user.name ?? user.email} />
                    <AvatarFallback className="bg-[#b1dbb8] text-[#0f3e17] text-xs font-normal">
                      {getInitials(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    {user.name && (
                      <p className="text-sm font-normal tracking-[-0.42px] text-black truncate">
                        {user.name}
                      </p>
                    )}
                    <p className="text-xs text-[#222222] tracking-[-0.36px] truncate">
                      {user.email}
                    </p>
                  </div>
                  <ChevronDown aria-hidden="true" className="h-4 w-4 text-[#333333] shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="top"
                className="w-52 rounded-[14px] border-[#e5e7eb] bg-[#fffefc]"
              >
                <DropdownMenuItem asChild>
                  <Link
                    href={`/orgs/${orgId}/settings/members`}
                    className="rounded-[7px] text-[#222222] focus:bg-[#e1f4df] focus:text-[#0f3e17]"
                  >
                    <Users aria-hidden="true" className="h-4 w-4 mr-2" />
                    Members &amp; Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#e5e7eb]" />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer rounded-[7px]"
                  onClick={handleSignOut}
                >
                  <LogOut aria-hidden="true" className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Collapse toggle — floats at the right edge */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "absolute -right-3 top-[72px] z-10 flex h-6 w-6 items-center justify-center rounded-full",
            "border border-[#e5e7eb] bg-[#fffefc] shadow-sm",
            "hover:bg-[#e1f4df] hover:border-[#b1dbb8] transition-colors",
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3 text-[#0f3e17]" />
          ) : (
            <ChevronLeft className="h-3 w-3 text-[#0f3e17]" />
          )}
        </button>
      </aside>
    </TooltipProvider>
  );
}
