"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };
type NavColumn = { heading?: string; items: NavItem[] };
type NavGroup = { label: string; columns: NavColumn[] };

// Groups open a panel of headed columns, as on vercel.com. Plain entries are links.
// Platform anchors point at sections of /product.
export const NAV: (NavGroup | NavItem)[] = [
  {
    label: "Platform",
    columns: [
      {
        heading: "Capture",
        items: [
          { href: "/product#evidence", label: "Evidence capture" },
          { href: "/field-app", label: "Field app" },
          { href: "/product#operations", label: "Supply chain and site operations" },
        ],
      },
      {
        heading: "Measure",
        items: [
          { href: "/product#carbon", label: "Carbon accounting" },
          { href: "/product#planning", label: "Targets and planning" },
        ],
      },
      {
        heading: "Govern",
        items: [
          { href: "/product#reporting", label: "Reporting and assurance" },
          { href: "/product#compliance", label: "Compliance" },
          { href: "/product#management-systems", label: "Management systems" },
        ],
      },
    ],
  },
  {
    label: "Solutions",
    columns: [
      {
        heading: "By business",
        items: [
          { href: "/solutions/construction", label: "Main contractors" },
          { href: "/solutions/waste-haulage", label: "Waste and haulage" },
          { href: "/solutions/public-sector", label: "Public-sector suppliers" },
        ],
      },
      {
        heading: "By document",
        items: [
          { href: "/solutions/public-sector#crp", label: "Carbon Reduction Plan" },
          { href: "/product#reporting", label: "SECR report" },
          { href: "/solutions/public-sector#ppn-026", label: "PPN 026 social value" },
          { href: "/solutions/public-sector#bid-pack", label: "Bid carbon pack" },
        ],
      },
    ],
  },
  { href: "/pricing", label: "Pricing" },
  {
    label: "Trust",
    columns: [
      {
        items: [
          { href: "/security", label: "Security" },
          { href: "/methodology", label: "Methodology" },
        ],
      },
    ],
  },
  {
    label: "Resources",
    columns: [
      {
        items: [
          { href: "/blog", label: "Blog" },
          { href: "/resources", label: "Guides" },
          { href: "/tools/site-fuel-emissions-calculator", label: "Fuel calculator" },
          { href: "/developer", label: "Developers" },
        ],
      },
    ],
  },
];

const isGroup = (x: NavGroup | NavItem): x is NavGroup => "columns" in x;
const groupItems = (g: NavGroup) => g.columns.flatMap((c) => c.items);
// Panels from the first plain link (Pricing) onwards open leftwards so they stay on screen at 1024px.
const firstPlain = NAV.findIndex((e) => !isGroup(e));

export function SiteNav(_props: { theme?: "light" | "dark" } = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const pathname = usePathname();
  const barRef = useRef<HTMLElement>(null);

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
  // The bar is ink over the dark hero each page opens with, and paper once the page scrolls.
  const idle = scrolled ? "text-mk-text-2 hover:text-mk-text" : "text-mk-on-dark-2 hover:text-mk-on-dark";
  const current = scrolled ? "text-mk-text" : "text-mk-on-dark";

  return (
    <header ref={barRef} className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "border-b transition-colors duration-200",
          scrolled ? "border-mk-line bg-mk-paper/90 backdrop-blur-md" : "border-transparent bg-mk-ink",
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center px-4 sm:px-8">
          <Link href="/" aria-label="MetricOra home" className={cn("mr-8 flex shrink-0 items-center gap-2.5 text-[15px] font-semibold tracking-tight", current)}>
            <LogoMark size={22} />
            <span className="hidden sm:inline">MetricOra</span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV.map((entry, index) =>
              isGroup(entry) ? (
                <div key={entry.label} className="relative" onMouseLeave={() => setMenu(null)}>
                  <button
                    type="button"
                    aria-expanded={menu === entry.label}
                    onClick={() => setMenu((m) => (m === entry.label ? null : entry.label))}
                    onMouseEnter={() => setMenu(entry.label)}
                    className={cn(
                      "flex items-center gap-1 px-3 py-2 text-[14px] transition-colors",
                      menu === entry.label || groupItems(entry).some((i) => active(i.href)) ? current : idle,
                    )}
                  >
                    {entry.label}
                    <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform", menu === entry.label && "rotate-180")} />
                  </button>
                  {menu === entry.label ? (
                    <div className={cn("absolute top-full z-10 pt-3", index > firstPlain ? "right-0" : "left-0")}>
                      <div className="flex gap-10 rounded-xl border border-mk-line bg-mk-surface p-6 shadow-[0_24px_48px_-16px_rgba(19,29,41,0.25)]">
                        {entry.columns.map((col, ci) => (
                          <div key={col.heading ?? ci} className="w-[200px]">
                            {col.heading ? <p className="mb-3 text-[13px] text-mk-text-3">{col.heading}</p> : null}
                            <ul className="grid gap-1">
                              {col.items.map((item) => (
                                <li key={item.href}>
                                  <Link href={item.href} className="block rounded-md px-2 py-1.5 text-[14px] text-mk-text hover:bg-mk-text/5 focus-visible:bg-mk-text/5">
                                    {item.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Link
                  key={entry.href}
                  href={entry.href}
                  onMouseEnter={() => setMenu(null)}
                  className={cn("px-3 py-2 text-[14px] transition-colors", active(entry.href) ? current : idle)}
                >
                  {entry.label}
                </Link>
              ),
            )}
          </nav>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <Link href="/sign-in" className={cn("px-3 py-2 text-[14px] transition-colors", idle)}>
              Sign in
            </Link>
            <Link href="/sign-up" className="inline-flex h-10 items-center rounded-full bg-mk-accent px-5 text-[14px] font-medium text-white hover:bg-mk-accent-hover">
              Start a 30-day trial
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className={cn("ml-auto flex h-10 w-10 items-center justify-center rounded-md lg:hidden", current)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mx-4 mt-2 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-xl border border-mk-line bg-mk-surface shadow-[0_24px_48px_-16px_rgba(19,29,41,0.25)] sm:mx-8 lg:hidden">
          <nav aria-label="Main" className="grid gap-8 p-5 sm:grid-cols-2 sm:p-8">
            {NAV.map((entry) =>
              isGroup(entry) ? (
                <div key={entry.label}>
                  <p className="mb-2 text-[15px] font-semibold text-mk-text">{entry.label}</p>
                  {entry.columns.map((col, ci) => (
                    <div key={col.heading ?? ci} className={ci > 0 ? "mt-4" : undefined}>
                      {col.heading ? <p className="mb-1 text-[13px] text-mk-text-3">{col.heading}</p> : null}
                      <ul className="grid">
                        {col.items.map((item) => (
                          <li key={item.href}>
                            <Link href={item.href} onClick={() => setOpen(false)} className="block py-2 text-[15px] text-mk-text-2 hover:text-mk-text">
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div key={entry.href}>
                  <Link href={entry.href} onClick={() => setOpen(false)} className="block py-2 text-[15px] font-semibold text-mk-text hover:text-mk-text-2">
                    {entry.label}
                  </Link>
                </div>
              ),
            )}
          </nav>
          <div className="flex flex-wrap gap-3 border-t border-mk-line px-5 py-5 sm:px-8">
            <Link href="/sign-up" onClick={() => setOpen(false)} className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-mk-accent px-5 text-[15px] font-medium text-white">
              Start a 30-day trial
            </Link>
            <Link href="/sign-in" onClick={() => setOpen(false)} className="inline-flex h-11 w-full items-center justify-center text-[15px] text-mk-text-2">
              Sign in
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
