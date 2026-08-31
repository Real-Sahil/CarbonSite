"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Upload, FileText, BarChart2, Calculator,
  Target, Settings, Users, Inbox, LogOut, ChevronDown,
  ChevronLeft, ChevronRight, Briefcase, Heart, Clock, ListChecks,
  Menu, X, Layers, Leaf, ShieldCheck, Trash2, TrendingDown, LineChart, Truck,
  Zap, Eye, CalendarClock, BadgeCheck, BookOpen,
} from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NavItem { label: string; href: string; icon: React.ElementType; roles?: string[]; }
interface NavGroup { label: string; items: NavItem[]; }

const CORE_ROLES = ["admin", "editor", "reviewer", "viewer", "auditor"];
const EXTENDED_VIEW_ROLES = [...CORE_ROLES, "sustainability_director", "sustainability_manager", "operations_manager", "contract_manager"];

interface OrgSidebarProps {
  orgId: string; orgName: string;
  user: { name?: string | null; email: string };
  role?: string;
}

const COLLAPSED_KEY = "carbonsite:sidebar:collapsed";

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
}

export function OrgSidebar({ orgId, orgName, user, role }: OrgSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(COLLAPSED_KEY) === "true"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const allGroups: NavGroup[] = [
    { label: "", items: [{ label: "Dashboard", href: `/orgs/${orgId}/dashboard`, icon: LayoutDashboard }] },
    { label: "Data", items: [
      { label: "Imports",     href: `/orgs/${orgId}/imports`,     icon: Upload,     roles: CORE_ROLES },
      { label: "Records",     href: `/orgs/${orgId}/records`,     icon: FileText,   roles: CORE_ROLES },
      { label: "Submissions", href: `/orgs/${orgId}/submissions`, icon: Inbox,      roles: ["admin", "editor", "reviewer"] },
      { label: "Tasks",       href: `/orgs/${orgId}/tasks`,       icon: ListChecks },
    ]},
    { label: "Calculations", items: [
      { label: "Analytics",       href: `/orgs/${orgId}/analytics`,       icon: LineChart,  roles: CORE_ROLES },
      { label: "Calculations",    href: `/orgs/${orgId}/calculations`,    icon: Calculator, roles: CORE_ROLES },
      { label: "Embodied Carbon", href: `/orgs/${orgId}/embodied-carbon`, icon: Layers,     roles: CORE_ROLES },
      { label: "Reports",         href: `/orgs/${orgId}/reports`,         icon: BarChart2,  roles: CORE_ROLES },
    ]},
    { label: "Planning", items: [
      { label: "Targets",      href: `/orgs/${orgId}/targets`,      icon: Target,       roles: CORE_ROLES },
      { label: "SBTi Roadmap", href: `/orgs/${orgId}/sbti`,         icon: TrendingDown, roles: CORE_ROLES },
      { label: "Offsets",      href: `/orgs/${orgId}/offsets`,      icon: Leaf,         roles: CORE_ROLES },
      { label: "Compliance",         href: `/orgs/${orgId}/compliance`,                       icon: ShieldCheck,   roles: CORE_ROLES },
      { label: "Reg. Calendar",      href: `/orgs/${orgId}/compliance/deadlines`,              icon: CalendarClock, roles: CORE_ROLES },
      { label: "Assurance",          href: `/orgs/${orgId}/compliance/assurance-readiness`,    icon: BadgeCheck,    roles: CORE_ROLES },
      { label: "ESRS E1 Gap",        href: `/orgs/${orgId}/compliance/esrs-e1`,                icon: BookOpen,      roles: CORE_ROLES },
      { label: "Waste",        href: `/orgs/${orgId}/waste`,        icon: Trash2,       roles: CORE_ROLES },
      { label: "Social Value", href: `/orgs/${orgId}/social-value`, icon: Heart,        roles: EXTENDED_VIEW_ROLES },
    ]},
    { label: "Contracts", items: [
      { label: "Contracts", href: `/orgs/${orgId}/contracts`, icon: Briefcase, roles: EXTENDED_VIEW_ROLES },
    ]},
    { label: "Admin", items: [
      { label: "Suppliers",      href: `/orgs/${orgId}/settings/suppliers`,           icon: Truck,      roles: ["admin"] },
      { label: "Performance",    href: `/orgs/${orgId}/suppliers/performance`,        icon: LineChart,  roles: ["admin"] },
      { label: "Invoice Review", href: `/orgs/${orgId}/finance/invoice-review`,       icon: Zap,        roles: ["admin", "editor"] },
      { label: "SSO Config",     href: `/orgs/${orgId}/settings/sso`,                 icon: ShieldCheck, roles: ["admin"] },
      { label: "Data Lineage",   href: `/orgs/${orgId}/audit/data-lineage`,           icon: Eye,        roles: ["admin", "auditor"] },
      { label: "Audit Trail",    href: `/orgs/${orgId}/audit`,                       icon: Clock,       roles: CORE_ROLES },
      { label: "Settings",       href: role === "admin" ? `/orgs/${orgId}/settings/members` : `/orgs/${orgId}/settings/operations`, icon: Settings, roles: ["admin", "editor"] },
    ]},
  ];

  const navGroups: NavGroup[] = allGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.roles || (role != null && item.roles.includes(role))) }))
    .filter((group) => group.items.length > 0);

  const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

  async function handleSignOut() { await authClient.signOut(); router.push("/sign-in"); }

  const NavLink = ({ item, onClick }: { item: NavItem; onClick?: () => void }) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        href={item.href}
        prefetch={true}
        onClick={onClick}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-normal tracking-tight transition-all",
          collapsed ? "justify-center px-2" : "",
          isActive
            ? "bg-gradient-to-r from-amber-500/15 to-orange-500/10 text-amber-300 border border-amber-500/20"
            : "text-slate-400 hover:text-slate-100 hover:bg-slate-700/50 border border-transparent",
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-amber-400" : "text-slate-500")} aria-hidden="true" />
        {!collapsed && item.label}
      </Link>
    );
  };

  const SidebarInner = ({ onNavClick }: { onNavClick?: () => void }) => (
    <>
      {/* Logo */}
      <div className={cn("flex items-center border-b border-slate-700/60 overflow-hidden", collapsed ? "px-3 pt-5 pb-4 justify-center" : "px-4 pt-5 pb-4")}>
        {collapsed ? (
          <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.5)]" title={orgName}>
            <Leaf className="h-4 w-4 text-white" />
          </span>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.5)]">
              <Leaf className="h-4 w-4 text-white" />
            </span>
            <div className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight text-[#F8FAFC]">CarbonSite</span>
              <span className="text-[11px] text-slate-400 font-normal block truncate" title={orgName}>{orgName}</span>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col overflow-y-auto overflow-x-hidden" aria-label="Organisation navigation">
        {navGroups.map((group, groupIdx) => (
          <div key={group.label || "__top__"} className={cn(groupIdx > 0 && "mt-4")}>
            {group.label && !collapsed && (
              <p className="px-2.5 mb-1 text-[9px] uppercase tracking-[0.12em] font-semibold text-slate-600">{group.label}</p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const link = <NavLink key={item.href} item={item} onClick={onNavClick} />;
                if (collapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs bg-[#1A2942] border-slate-700/50 text-[#F8FAFC]">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                }
                return link;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className={cn("border-t border-slate-700/60 px-2 py-3", collapsed && "flex justify-center")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-700/50 transition-colors" onClick={handleSignOut} title="Sign out">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={undefined} alt={user.name ?? user.email} />
                  <AvatarFallback className="bg-amber-500/20 text-amber-400 text-[10px] font-medium border border-amber-500/20">{getInitials(user.name, user.email)}</AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs bg-[#1A2942] border-slate-700/50 text-[#F8FAFC]">
              {user.name ?? user.email}<br /><span className="text-slate-400">Click to sign out</span>
            </TooltipContent>
          </Tooltip>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-slate-700/50 transition-colors text-left">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={undefined} alt={user.name ?? user.email} />
                  <AvatarFallback className="bg-amber-500/20 text-amber-400 text-xs font-medium border border-amber-500/20">{getInitials(user.name, user.email)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  {user.name && <p className="text-xs font-medium text-slate-300 truncate">{user.name}</p>}
                  <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                </div>
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-600 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-52 rounded-xl bg-[#1A2942] border-slate-700/50">
              <DropdownMenuItem asChild>
                <Link href={`/orgs/${orgId}/settings/members`} className="rounded-lg text-slate-300 focus:text-slate-100 focus:bg-slate-700/50">
                  <Users aria-hidden="true" className="h-4 w-4 mr-2" />
                  Members &amp; Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700/40" />
              <DropdownMenuItem className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer rounded-lg" onClick={handleSignOut}>
                <LogOut aria-hidden="true" className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  );

  return (
    <TooltipProvider delayDuration={200}>
      {/* ── Mobile top bar ───────────────────────────────────────────────────── */}
      <header className="flex md:hidden fixed top-0 left-0 right-0 z-40 items-center h-14 px-4 bg-[#1E293B]/95 backdrop-blur-xl border-b border-slate-700/60 shrink-0">
        <button aria-label="Open menu" onClick={() => setMobileOpen(true)} className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-slate-700/50 transition-colors">
          <Menu className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </button>
        <div className="ml-3 flex items-center gap-2 min-w-0">
          <span className="h-6 w-6 rounded-md bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
            <Leaf className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-[#F8FAFC]">CarbonSite</span>
          <span className="text-xs text-slate-400 truncate max-w-[120px]">/ {orgName}</span>
        </div>
      </header>
      <div className="h-14 md:hidden shrink-0" aria-hidden="true" />

      {/* ── Mobile drawer ─────────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#1E293B]/97 backdrop-blur-2xl border-r border-slate-700/60 flex flex-col">
            {/* Mesh blob */}
            <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(13,148,136,0.2)_0%,transparent_70%)] pointer-events-none" />
            <div className="relative flex items-center justify-between px-4 pt-5 pb-4 border-b border-slate-700/60">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.5)]">
                  <Leaf className="h-4 w-4 text-white" />
                </span>
                <div className="min-w-0">
                  <span className="block text-sm font-semibold tracking-tight text-[#F8FAFC]">CarbonSite</span>
                  <span className="text-xs text-slate-400 block truncate">{orgName}</span>
                </div>
              </div>
              <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-slate-700/50 transition-colors ml-2 shrink-0">
                <X className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto" aria-label="Organisation navigation">
              {navItems.map((item) => (
                <NavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />
              ))}
            </nav>
            <div className="border-t border-slate-700/60 px-2 py-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-slate-700/50 transition-colors text-left">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={undefined} alt={user.name ?? user.email} />
                      <AvatarFallback className="bg-amber-500/20 text-amber-400 text-xs font-medium border border-amber-500/20">{getInitials(user.name, user.email)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      {user.name && <p className="text-xs font-medium text-slate-300 truncate">{user.name}</p>}
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                    </div>
                    <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-52 rounded-xl bg-[#1A2942] border-slate-700/50">
                  <DropdownMenuItem asChild>
                    <Link href={`/orgs/${orgId}/settings/members`} onClick={() => setMobileOpen(false)} className="rounded-lg text-slate-300 focus:text-slate-100 focus:bg-slate-700/50">
                      <Users aria-hidden="true" className="h-4 w-4 mr-2" />
                      Members &amp; Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-700/40" />
                  <DropdownMenuItem className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer rounded-lg" onClick={handleSignOut}>
                    <LogOut aria-hidden="true" className="h-4 w-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ───────────────────────────────────────────────────── */}
      <aside className={cn("relative hidden md:flex flex-col min-h-screen bg-[#1E293B] border-r border-slate-700/60 shrink-0 transition-[width] duration-200 overflow-hidden", collapsed ? "w-[56px]" : "w-56")}>
        {/* Ambient mesh glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(13,148,136,0.18)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.1)_0%,transparent_70%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col flex-1">
          <SidebarInner />
        </div>
        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[72px] z-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700/50 bg-[#253346] shadow-sm hover:bg-[#2D3F54] hover:border-slate-600 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3 w-3 text-slate-400" /> : <ChevronLeft className="h-3 w-3 text-slate-400" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}
