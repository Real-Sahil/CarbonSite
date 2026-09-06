"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Upload, FileText, BarChart2, Calculator,
  Target, Settings, Users, Inbox, LogOut, ChevronDown,
  ChevronLeft, ChevronRight, Briefcase, Heart, Clock, ListChecks,
  Menu, X, Layers, Leaf, ShieldCheck, Trash2, TrendingDown, LineChart, Truck,
  Zap, Eye, PackageSearch, CalendarClock, BadgeCheck, BookOpen, Plug, Sliders, GitBranch, Anchor,
  ShieldAlert, Siren, Scale, Sprout, ClipboardCheck, Network, Grid3x3, Compass,
  TrendingUp, Droplets,
} from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationBell } from "@/components/notification-bell";
import { cn } from "@/lib/utils";

interface NavItem { label: string; href: string; icon: React.ElementType; roles?: string[]; }
/** A micro-group of items within a product's accordion panel, e.g. "Calculations" inside "CarbonSite". */
interface NavSection { label?: string; items: NavItem[]; }
/** A top-level, collapsible product group in the sidebar. */
interface NavGroup { label: string; icon: React.ElementType; sections: NavSection[]; }

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

  const dashboardItem: NavItem = { label: "Dashboard", href: `/orgs/${orgId}/dashboard`, icon: LayoutDashboard };

  const allGroups: NavGroup[] = [
    { label: "CarbonSite", icon: Leaf, sections: [
      { label: "Data", items: [
        { label: "Imports",          href: `/orgs/${orgId}/imports`,           icon: Upload,        roles: CORE_ROLES },
        { label: "Records",          href: `/orgs/${orgId}/records`,           icon: FileText,      roles: CORE_ROLES },
        { label: "Submissions",      href: `/orgs/${orgId}/submissions`,       icon: Inbox,         roles: ["admin", "editor", "reviewer"] },
        { label: "Supplier Reports", href: `/orgs/${orgId}/supplier-reports`,  icon: PackageSearch, roles: ["admin", "editor", "reviewer", "auditor"] },
        { label: "Tasks",            href: `/orgs/${orgId}/tasks`,             icon: ListChecks },
        { label: "Contracts",        href: `/orgs/${orgId}/contracts`,         icon: Briefcase,     roles: EXTENDED_VIEW_ROLES },
      ]},
      { label: "Calculations", items: [
        { label: "Analytics",       href: `/orgs/${orgId}/analytics`,       icon: LineChart,  roles: CORE_ROLES },
        { label: "Calculations",    href: `/orgs/${orgId}/calculations`,    icon: Calculator, roles: CORE_ROLES },
        { label: "Embodied Carbon", href: `/orgs/${orgId}/embodied-carbon`, icon: Layers,     roles: CORE_ROLES },
        { label: "Scenarios",       href: `/orgs/${orgId}/scenarios`,       icon: Sliders,    roles: CORE_ROLES },
      ]},
      { label: "Inventory governance", items: [
        { label: "Boundary",     href: `/orgs/${orgId}/boundary`,     icon: GitBranch, roles: EXTENDED_VIEW_ROLES },
        { label: "Base Year",    href: `/orgs/${orgId}/base-year`,    icon: Anchor,    roles: EXTENDED_VIEW_ROLES },
        { label: "Completeness", href: `/orgs/${orgId}/completeness`, icon: Grid3x3,   roles: EXTENDED_VIEW_ROLES },
      ]},
      { label: "Environment", items: [
        { label: "Overview",       href: `/orgs/${orgId}/environment`,                icon: ShieldAlert, roles: EXTENDED_VIEW_ROLES },
        { label: "Permits",        href: `/orgs/${orgId}/environment/permits`,        icon: BadgeCheck,  roles: EXTENDED_VIEW_ROLES },
        { label: "Incidents",      href: `/orgs/${orgId}/environment/incidents`,      icon: Siren,       roles: EXTENDED_VIEW_ROLES },
        { label: "Legal Register", href: `/orgs/${orgId}/environment/legal-register`, icon: Scale,       roles: EXTENDED_VIEW_ROLES },
        { label: "Aspects",        href: `/orgs/${orgId}/environment/aspects`,        icon: ListChecks,  roles: EXTENDED_VIEW_ROLES },
        { label: "Biodiversity",   href: `/orgs/${orgId}/biodiversity`,               icon: Sprout,      roles: EXTENDED_VIEW_ROLES },
        { label: "Water",         href: `/orgs/${orgId}/water`,                       icon: Droplets,    roles: EXTENDED_VIEW_ROLES },
        { label: "Waste",         href: `/orgs/${orgId}/waste`,                       icon: Trash2,      roles: EXTENDED_VIEW_ROLES },
      ]},
    ]},
    { label: "Social Value", icon: Heart, sections: [
      { items: [
        { label: "Social Value", href: `/orgs/${orgId}/social-value`, icon: Heart, roles: EXTENDED_VIEW_ROLES },
      ]},
    ]},
    { label: "Impact Reports", icon: BarChart2, sections: [
      { items: [
        { label: "Reports", href: `/orgs/${orgId}/reports`, icon: BarChart2, roles: CORE_ROLES },
      ]},
      { label: "Compliance", items: [
        { label: "Compliance",         href: `/orgs/${orgId}/compliance`,                       icon: ShieldCheck,    roles: CORE_ROLES },
        { label: "Reg. Calendar",      href: `/orgs/${orgId}/compliance/deadlines`,              icon: CalendarClock,  roles: CORE_ROLES },
        { label: "Assurance",          href: `/orgs/${orgId}/compliance/assurance-readiness`,    icon: BadgeCheck,     roles: CORE_ROLES },
        { label: "ESRS E1 Gap",        href: `/orgs/${orgId}/compliance/esrs-e1`,                icon: BookOpen,       roles: CORE_ROLES },
        { label: "Framework Crosswalk", href: `/orgs/${orgId}/compliance/crosswalk`,             icon: Network,        roles: EXTENDED_VIEW_ROLES },
        { label: "Assurance Engagements", href: `/orgs/${orgId}/assurance`,                      icon: ClipboardCheck, roles: ["admin", "sustainability_director", "auditor", "sustainability_manager"] },
      ]},
      { label: "Audit", items: [
        { label: "Audit Trail",    href: `/orgs/${orgId}/audit`,             icon: Clock, roles: CORE_ROLES },
        { label: "Data Lineage",   href: `/orgs/${orgId}/audit/data-lineage`, icon: Eye,   roles: ["admin", "auditor"] },
      ]},
    ]},
    { label: "Carbon Forecast", icon: TrendingUp, sections: [
      { items: [
        { label: "Pathway",      href: `/orgs/${orgId}/pathway`,      icon: Compass,      roles: CORE_ROLES },
        { label: "Targets",      href: `/orgs/${orgId}/targets`,      icon: Target,       roles: CORE_ROLES },
        { label: "SBTi Roadmap", href: `/orgs/${orgId}/sbti`,         icon: TrendingDown, roles: CORE_ROLES },
        { label: "Offsets",      href: `/orgs/${orgId}/offsets`,      icon: Leaf,         roles: CORE_ROLES },
      ]},
    ]},
    { label: "Admin", icon: Settings, sections: [
      { items: [
        { label: "Integrations",        href: `/orgs/${orgId}/integrations`,                 icon: Plug,        roles: ["admin", "editor"] },
        { label: "Accounting Software",  href: `/orgs/${orgId}/integrations/accounting`,      icon: Plug,        roles: ["admin", "editor"] },
        { label: "Supplier Management",  href: `/orgs/${orgId}/integrations/suppliers`,       icon: Truck,       roles: ["admin", "editor"] },
        { label: "Suppliers",            href: `/orgs/${orgId}/settings/suppliers`,           icon: Truck,       roles: ["admin"] },
        { label: "Performance",          href: `/orgs/${orgId}/suppliers/performance`,        icon: LineChart,   roles: ["admin"] },
        { label: "Invoice Review",       href: `/orgs/${orgId}/finance/invoice-review`,       icon: Zap,         roles: ["admin", "editor"] },
        { label: "SSO Config",           href: `/orgs/${orgId}/settings/sso`,                 icon: ShieldCheck, roles: ["admin"] },
        { label: "Settings",             href: role === "admin" ? `/orgs/${orgId}/settings/members` : `/orgs/${orgId}/settings/operations`, icon: Settings, roles: ["admin", "editor"] },
      ]},
    ]},
  ];

  // Filter by role at every level, then drop empty sections/groups.
  const navGroups: NavGroup[] = allGroups
    .map((group) => ({
      ...group,
      sections: group.sections
        .map((section) => ({ ...section, items: section.items.filter((item) => !item.roles || (role != null && item.roles.includes(role))) }))
        .filter((section) => section.items.length > 0),
    }))
    .filter((group) => group.sections.length > 0);

  function groupIsActive(group: NavGroup): boolean {
    return group.sections.some((s) => s.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/")));
  }

  const [openGroup, setOpenGroup] = useState<string | null>(() => navGroups.find(groupIsActive)?.label ?? navGroups[0]?.label ?? null);

  // Keep the accordion in sync with the active route (e.g. after clicking a link elsewhere).
  useEffect(() => {
    const active = navGroups.find(groupIsActive);
    if (active && active.label !== openGroup) setOpenGroup(active.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function handleSignOut() { await authClient.signOut(); router.push("/sign-in"); }

  const NavLink = ({ item, onClick, indent }: { item: NavItem; onClick?: () => void; indent?: boolean }) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        href={item.href}
        prefetch={true}
        onClick={onClick}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-normal tracking-tight transition-all",
          collapsed ? "justify-center px-2" : indent ? "ml-1" : "",
          isActive
            ? "bg-[#fff7ed] text-[#f97316] border border-[#fed7aa]"
            : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent",
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[#f97316]" : "text-slate-400")} aria-hidden="true" />
        {!collapsed && item.label}
      </Link>
    );
  };

  /** Renders the full nav: ungrouped Dashboard link, then one collapsible product group per accordion panel. */
  const NavContent = ({ onNavClick }: { onNavClick?: () => void }) => (
    <>
      <div className="mb-1">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{<NavLink item={dashboardItem} onClick={onNavClick} />}</TooltipTrigger>
            <TooltipContent side="right" className="text-xs bg-white border-slate-200 text-slate-700 shadow-md">{dashboardItem.label}</TooltipContent>
          </Tooltip>
        ) : (
          <NavLink item={dashboardItem} onClick={onNavClick} />
        )}
      </div>

      {navGroups.map((group) => {
        const GroupIcon = group.icon;
        const isOpen = collapsed || openGroup === group.label;
        const isActive = groupIsActive(group);
        return (
          <div key={group.label} className="mt-1">
            {!collapsed && (
              <button
                type="button"
                onClick={() => setOpenGroup((prev) => (prev === group.label ? null : group.label))}
                aria-expanded={isOpen}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
                  isActive ? "text-[#f97316]" : "text-slate-400 hover:text-slate-600",
                )}
              >
                <GroupIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
              </button>
            )}
            {isOpen && (
              <div className={cn("flex flex-col gap-0.5", !collapsed && "mt-0.5")}>
                {group.sections.map((section, sIdx) => (
                  <div key={section.label ?? sIdx} className={cn(sIdx > 0 && !collapsed && "mt-2")}>
                    {section.label && !collapsed && (
                      <p className="px-2.5 mb-1 text-[9px] uppercase tracking-[0.12em] font-semibold text-slate-600">{section.label}</p>
                    )}
                    <div className="flex flex-col gap-0.5">
                      {section.items.map((item) => {
                        const link = <NavLink key={item.href} item={item} onClick={onNavClick} indent />;
                        if (collapsed) {
                          return (
                            <Tooltip key={item.href}>
                              <TooltipTrigger asChild>{link}</TooltipTrigger>
                              <TooltipContent side="right" className="text-xs bg-white border-slate-200 text-slate-700 shadow-md">{item.label}</TooltipContent>
                            </Tooltip>
                          );
                        }
                        return link;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );

  const SidebarInner = ({ onNavClick }: { onNavClick?: () => void }) => (
    <>
      {/* Logo */}
      <div className={cn("flex items-center border-b border-slate-200 overflow-hidden", collapsed ? "px-3 pt-5 pb-4 justify-center" : "px-4 pt-5 pb-4")}>
        {collapsed ? (
          <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center" title={orgName}>
            <Leaf className="h-4 w-4 text-white" />
          </span>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 w-full">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shrink-0">
              <Leaf className="h-4 w-4 text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-semibold tracking-tight text-slate-900">CarbonSite</span>
              <span className="text-[11px] text-slate-500 font-normal block truncate" title={orgName}>{orgName}</span>
            </div>
            <NotificationBell orgId={orgId} />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col overflow-y-auto overflow-x-hidden" aria-label="Organisation navigation">
        <NavContent onNavClick={onNavClick} />
      </nav>

      {/* User footer */}
      <div className={cn("border-t border-slate-200 px-2 py-3", collapsed && "flex justify-center")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-100 transition-colors" onClick={handleSignOut} title="Sign out">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={undefined} alt={user.name ?? user.email} />
                  <AvatarFallback className="bg-[#fff7ed] text-[#f97316] text-[10px] font-medium border border-[#fed7aa]">{getInitials(user.name, user.email)}</AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs bg-white border-slate-200 text-slate-700 shadow-md">
              {user.name ?? user.email}<br /><span className="text-slate-400">Click to sign out</span>
            </TooltipContent>
          </Tooltip>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors text-left">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={undefined} alt={user.name ?? user.email} />
                  <AvatarFallback className="bg-[#fff7ed] text-[#f97316] text-xs font-medium border border-[#fed7aa]">{getInitials(user.name, user.email)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  {user.name && <p className="text-xs font-medium text-slate-700 truncate">{user.name}</p>}
                  <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                </div>
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-52 rounded-xl bg-white border-slate-200 shadow-lg">
              <DropdownMenuItem asChild>
                <Link href={`/orgs/${orgId}/settings/members`} className="rounded-lg text-slate-600 focus:text-slate-900 focus:bg-slate-100">
                  <Users aria-hidden="true" className="h-4 w-4 mr-2" />
                  Members &amp; Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-200" />
              <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer rounded-lg" onClick={handleSignOut}>
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
      <header className="flex md:hidden fixed top-0 left-0 right-0 z-40 items-center h-14 px-4 bg-white/95 backdrop-blur-xl border-b border-slate-200 shrink-0">
        <button aria-label="Open menu" onClick={() => setMobileOpen(true)} className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-slate-100 transition-colors">
          <Menu className="h-5 w-5 text-slate-500" aria-hidden="true" />
        </button>
        <div className="ml-3 flex items-center gap-2 min-w-0">
          <span className="h-6 w-6 rounded-md bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shrink-0">
            <Leaf className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900">CarbonSite</span>
          <span className="text-xs text-slate-500 truncate max-w-[120px]">/ {orgName}</span>
        </div>
        <div className="ml-auto">
          <NotificationBell orgId={orgId} />
        </div>
      </header>
      <div className="h-14 md:hidden shrink-0" aria-hidden="true" />

      {/* ── Mobile drawer ─────────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white/97 backdrop-blur-2xl border-r border-slate-200 flex flex-col">
            <div className="relative flex items-center justify-between px-4 pt-5 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shrink-0">
                  <Leaf className="h-4 w-4 text-white" />
                </span>
                <div className="min-w-0">
                  <span className="block text-sm font-semibold tracking-tight text-slate-900">CarbonSite</span>
                  <span className="text-xs text-slate-500 block truncate">{orgName}</span>
                </div>
              </div>
              <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-slate-100 transition-colors ml-2 shrink-0">
                <X className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 px-2 py-3 flex flex-col overflow-y-auto" aria-label="Organisation navigation">
              <NavContent onNavClick={() => setMobileOpen(false)} />
            </nav>
            <div className="border-t border-slate-200 px-2 py-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors text-left">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={undefined} alt={user.name ?? user.email} />
                      <AvatarFallback className="bg-[#fff7ed] text-[#f97316] text-xs font-medium border border-[#fed7aa]">{getInitials(user.name, user.email)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      {user.name && <p className="text-xs font-medium text-slate-700 truncate">{user.name}</p>}
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                    </div>
                    <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-52 rounded-xl bg-white border-slate-200 shadow-lg">
                  <DropdownMenuItem asChild>
                    <Link href={`/orgs/${orgId}/settings/members`} onClick={() => setMobileOpen(false)} className="rounded-lg text-slate-600 focus:text-slate-900 focus:bg-slate-100">
                      <Users aria-hidden="true" className="h-4 w-4 mr-2" />
                      Members &amp; Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-200" />
                  <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer rounded-lg" onClick={handleSignOut}>
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
      <aside className={cn("relative hidden md:flex flex-col min-h-screen bg-white border-r border-slate-200 shrink-0 transition-[width] duration-200 overflow-hidden", collapsed ? "w-[56px]" : "w-56")}>
        <div className="relative z-10 flex flex-col flex-1">
          <SidebarInner />
        </div>
        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[72px] z-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3 w-3 text-slate-500" /> : <ChevronLeft className="h-3 w-3 text-slate-500" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}
