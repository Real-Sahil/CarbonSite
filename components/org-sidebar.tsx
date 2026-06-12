"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
    { label: "Dashboard",   href: `/orgs/${orgId}/dashboard`,          icon: LayoutDashboard },
    { label: "Submissions", href: `/orgs/${orgId}/submissions`,         icon: Inbox },
    { label: "Records",     href: `/orgs/${orgId}/records`,             icon: FileText },
    { label: "Imports",     href: `/orgs/${orgId}/imports`,             icon: Upload },
    { label: "Calculations", href: `/orgs/${orgId}/calculations`,       icon: Calculator },
    { label: "Reports",     href: `/orgs/${orgId}/reports`,             icon: BarChart2 },
    { label: "Targets",     href: `/orgs/${orgId}/targets`,             icon: Target },
    { label: "Settings",    href: `/orgs/${orgId}/settings/members`,    icon: Settings },
  ];

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-[#fffefc] border-r border-[#e5e7eb] shrink-0">
      {/* Logo + Org */}
      <div className="px-5 pt-6 pb-4 border-b border-[#e5e7eb]">
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

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5" aria-label="Organisation navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-[7px] text-sm font-normal tracking-[-0.42px] transition-colors",
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

      {/* User footer */}
      <div className="px-3 py-4 border-t border-[#e5e7eb]">
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
                <p className="text-xs text-[#222222] tracking-[-0.36px] truncate">{user.email}</p>
              </div>
              <ChevronDown aria-hidden="true" className="h-4 w-4 text-[#333333] shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52 rounded-[14px] border-[#e5e7eb] bg-[#fffefc]">
            <DropdownMenuItem asChild>
              <Link href={`/orgs/${orgId}/settings/members`} className="rounded-[7px] text-[#222222] focus:bg-[#e1f4df] focus:text-[#0f3e17]">
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
    </aside>
  );
}
