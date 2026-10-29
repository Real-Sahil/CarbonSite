"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, Leaf, ShieldCheck, Users } from "lucide-react";

interface TabBarProps {
  orgId: string;
  /** Field submissions waiting for review; shown on Records. */
  recordsBadge: number;
}

/**
 * Phone navigation for the earthy shell (docs/design/earthy-tech, phase 6). Below the md breakpoint the
 * sidebar collapses to its hamburger, so the five main destinations sit in a fixed bar the thumb can reach.
 * The blur is limited to this bar, never content. Targets are 44px or taller; the bar clears the home indicator.
 */
export function EarthyTabBar({ orgId, recordsBadge }: TabBarProps) {
  const pathname = usePathname();
  const root = `/orgs/${orgId}`;
  const tabs = [
    { href: `${root}/dashboard`, label: "Summary", Icon: BarChart3 },
    { href: `${root}/carbon-intelligence`, label: "Carbon", Icon: Leaf },
    { href: `${root}/social-value`, label: "Social", Icon: Users },
    { href: `${root}/audit`, label: "Audit", Icon: ShieldCheck },
    { href: `${root}/records`, label: "Records", Icon: ClipboardList, badge: recordsBadge },
  ];

  return (
    <nav aria-label="Main" className="e-tabbar md:hidden">
      <ul className="mx-auto flex max-w-xl items-stretch justify-around">
        {tabs.map(({ href, label, Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="e-press flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium"
                style={{ color: active ? "var(--action)" : "var(--ink-3)" }}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={active ? 2.25 : 1.75} />
                  {badge ? (
                    <span className="e-mono absolute -right-3 -top-1.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4" style={{ background: "var(--hi)", color: "var(--surface)" }}>
                      <span aria-hidden="true">{badge > 99 ? "99+" : badge}</span>
                      <span className="sr-only">{badge} waiting for review</span>
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
