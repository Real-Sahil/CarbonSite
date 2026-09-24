"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; note?: string };
type NavGroup = { label: string; items: NavItem[] };

// Five top-level entries. Platform anchors point at sections of /product.
export const NAV: (NavGroup | NavItem)[] = [
  {
    label: "Platform",
    items: [
      { href: "/product#evidence", label: "Evidence capture", note: "Field app, review queue, OCR checks" },
      { href: "/product#carbon", label: "Carbon accounting", note: "Scope 1, 2 and 3 with named factors" },
      { href: "/product#reporting", label: "Reporting and assurance", note: "Snapshots, verified reports, audit trail" },
      { href: "/product#compliance", label: "Compliance", note: "SECR, PPN 006, ESRS E1, CDP crosswalk" },
      { href: "/product#planning", label: "Targets and planning", note: "Base year, pathway, carbon price" },
      { href: "/product#operations", label: "Supply chain and site operations", note: "Suppliers, social value, environment" },
      { href: "/field-app", label: "Field app", note: "Offline capture for site teams" },
    ],
  },
  {
    label: "Solutions",
    items: [
      { href: "/solutions/construction", label: "Main contractors", note: "Sites, plant, materials, subcontractors" },
      { href: "/solutions/waste-haulage", label: "Waste and haulage", note: "Tickets, EWC codes, routes" },
      { href: "/solutions/public-sector", label: "Public-sector suppliers", note: "PPN 006 plans and social value" },
    ],
  },
  { href: "/pricing", label: "Pricing" },
  {
    label: "Trust",
    items: [
      { href: "/security", label: "Security", note: "Where data lives and who can see it" },
      { href: "/methodology", label: "Methodology", note: "Factor libraries, versions, licences" },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/blog", label: "Blog" },
      { href: "/resources", label: "Guides" },
      { href: "/developer", label: "Developers", note: "REST API and webhooks" },
    ],
  },
];

const isGroup = (x: NavGroup | NavItem): x is NavGroup => "items" in x;

export function SiteNav(_props: { theme?: "light" | "dark" } = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMenu(null);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        setOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const active = (href: string) => pathname === href.split("#")[0];

  return (
    <header
      ref={barRef}
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200",
        scrolled || open || menu ? "border-white/10 bg-mk-ink/95 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight text-mk-on-dark">
          <LogoMark size={24} />
          MetricOra
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((entry) =>
            isGroup(entry) ? (
              <div key={entry.label} className="relative">
                <button
                  type="button"
                  aria-expanded={menu === entry.label}
                  onClick={() => setMenu((m) => (m === entry.label ? null : entry.label))}
                  onMouseEnter={() => setMenu(entry.label)}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-3 py-2 text-[14px] transition-colors",
                    menu === entry.label || entry.items.some((i) => active(i.href)) ? "text-mk-on-dark" : "text-mk-on-dark-2 hover:text-mk-on-dark",
                  )}
                >
                  {entry.label}
                  <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform", menu === entry.label && "rotate-180")} />
                </button>
                {menu === entry.label ? (
                  <div
                    onMouseLeave={() => setMenu(null)}
                    className="absolute left-0 top-full mt-2 w-[340px] rounded-[12px] border border-white/10 bg-mk-ink-2 p-2 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]"
                  >
                    {entry.items.map((item) => (
                      <Link key={item.href} href={item.href} className="block rounded-[8px] px-3 py-2.5 hover:bg-white/5 focus-visible:bg-white/5">
                        <span className="block text-[14px] font-medium text-mk-on-dark">{item.label}</span>
                        {item.note ? <span className="block text-[13px] text-mk-on-dark-3">{item.note}</span> : null}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <Link
                key={entry.href}
                href={entry.href}
                onMouseEnter={() => setMenu(null)}
                className={cn("rounded-md px-3 py-2 text-[14px] transition-colors", active(entry.href) ? "text-mk-on-dark" : "text-mk-on-dark-2 hover:text-mk-on-dark")}
              >
                {entry.label}
              </Link>
            ),
          )}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Link href="/sign-in" className="rounded-md px-3 py-2 text-[14px] text-mk-on-dark-2 hover:text-mk-on-dark">
            Sign in
          </Link>
          <Link href="/contact" className="inline-flex h-9 items-center rounded-[10px] border border-white/20 px-3.5 text-[14px] font-medium text-mk-on-dark hover:border-white/40">
            Book a pilot
          </Link>
          <Link href="/sign-up" className="inline-flex h-9 items-center rounded-[10px] bg-mk-accent px-3.5 text-[14px] font-medium text-white hover:bg-mk-accent-hover">
            Start trial
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="ml-auto rounded-md p-2 text-mk-on-dark hover:bg-white/5 lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 bg-mk-ink lg:hidden">
          <nav aria-label="Main" className="mx-auto grid w-full max-w-[1200px] gap-6 px-5 py-6 sm:grid-cols-2 sm:px-8">
            {NAV.map((entry) =>
              isGroup(entry) ? (
                <div key={entry.label}>
                  <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.12em] text-mk-on-dark-3">{entry.label}</p>
                  <ul className="grid gap-1">
                    {entry.items.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className="block py-1.5 text-[15px] text-mk-on-dark hover:text-mk-accent-lit">
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div key={entry.href}>
                  <Link href={entry.href} className="block py-1.5 text-[15px] font-medium text-mk-on-dark hover:text-mk-accent-lit">
                    {entry.label}
                  </Link>
                </div>
              ),
            )}
          </nav>
          <div className="mx-auto flex w-full max-w-[1200px] flex-wrap gap-3 border-t border-white/10 px-5 py-5 sm:px-8">
            <Link href="/sign-up" className="inline-flex h-11 flex-1 items-center justify-center rounded-[10px] bg-mk-accent px-5 text-[15px] font-medium text-white">
              Start trial
            </Link>
            <Link href="/contact" className="inline-flex h-11 flex-1 items-center justify-center rounded-[10px] border border-white/20 px-5 text-[15px] font-medium text-mk-on-dark">
              Book a pilot
            </Link>
            <Link href="/sign-in" className="inline-flex h-11 w-full items-center justify-center text-[15px] text-mk-on-dark-2">
              Sign in
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
