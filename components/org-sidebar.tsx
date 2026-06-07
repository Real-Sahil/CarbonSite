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
    <aside className="flex flex-col w-60 min-h-screen bg-white border-r border-slate-200 shrink-0">
      {/* Logo + Org */}
      <div className="px-5 pt-6 pb-4 border-b border-slate-100">
        <span className="text-lg font-bold text-green-700 tracking-tight block">
          CarbonSite
        </span>
        <span
          className="text-sm text-slate-600 font-medium mt-1 block truncate"
          title={orgName}
        >
          {orgName}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
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

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full px-2 py-2 rounded-md hover:bg-slate-50 transition-colors text-left group">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={undefined} alt={user.name ?? user.email} />
                <AvatarFallback>
                  {getInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                {user.name && (
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {user.name}
                  </p>
                )}
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52">
            <DropdownMenuItem asChild>
              <Link href={`/orgs/${orgId}/settings/members`}>
                <Users className="h-4 w-4 mr-2" />
                Members &amp; Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
