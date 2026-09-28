"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; note?: string };
type NavColumn = { heading?: string; items: NavItem[] };
// One real item per dropdown, beside the links on desktop only.
type NavCard = { href: string; title: string; text: string; cta: string };
type NavGroup = { label: string; columns: NavColumn[]; card?: NavCard };

// Five top-level entries. Platform anchors point at sections of /product.
export const NAV: (NavGroup | NavItem)[] = [
  {
    label: "Platform",
    columns: [
      {
        items: [
          { href: "/product#evidence", label: "Evidence capture", note: "Field app, review queue, OCR checks" },
          { href: "/product#carbon", label: "Carbon accounting", note: "Scope 1, 2 and 3 with named factors" },
          { href: "/product#reporting", label: "Reporting and assurance", note: "Snapshots, verified reports, audit trail" },
          { href: "/product#compliance", label: "Compliance", note: "SECR, PPN 006, ESRS E1, CDP crosswalk" },
          { href: "/product#planning", label: "Targets and planning", note: "Base year, pathway, carbon price" },
          { href: "/product#management-systems", label: "Management systems", note: "ISO 14001, 9001, 45001, registers, PQQ answers" },
          { href: "/product#operations", label: "Supply chain and site operations", note: "Suppliers, social value, environment" },
          { href: "/field-app", label: "Field app", note: "Offline capture for site teams" },
        ],
      },
    ],
    card: {
      href: "/sign-up?start=crp",
      title: "Start your Carbon Reduction Plan",
      text: "Work through the PPN 006 template section by section, with figures from your published snapshot.",
      cta: "Start the plan",
    },
  },
  {
    label: "Solutions",
    columns: [
      {
        heading: "By business",
        items: [
          { href: "/solutions/construction", label: "Main contractors", note: "Sites, plant, materials, subcontractors" },
          { href: "/solutions/waste-haulage", label: "Waste and haulage", note: "Tickets, EWC codes, routes" },
          { href: "/solutions/public-sector", label: "Public-sector suppliers", note: "PPN 006 plans and social value" },
        ],
      },
      {
        heading: "By document",
        items: [
          { href: "/solutions/public-sector#crp", label: "Carbon Reduction Plan", note: "PPN 006, checked before it is generated" },
          { href: "/product#reporting", label: "SECR report", note: "Energy and emissions from the same records" },
          { href: "/solutions/public-sector#ppn-026", label: "PPN 026 social value", note: "Jobs and skills KPIs with evidence" },
          { href: "/solutions/public-sector#bid-pack", label: "Bid carbon pack", note: "The carbon section of a tender" },
        ],
      },
    ],
    card: {
      href: "/solutions/public-sector#ppn-026",
      title: "PPN 026 applies from 1 January 2027",
      text: "Central government procurements of £1 million or more score social value on jobs and skills.",
      cta: "What it asks for",
    },
  },
  { href: "/pricing", label: "Pricing" },
  {
    label: "Trust",
    columns: [
      {
        items: [
          { href: "/security", label: "Security", note: "Where data lives and who can see it" },
          { href: "/methodology", label: "Methodology", note: "Factor libraries, versions, licences" },
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
          { href: "/developer", label: "Developers", note: "REST API and webhooks" },
        ],
      },
    ],
    card: {
      href: "/resources#pilot",
      title: "Planning a first reporting period",
      text: "Which year to start with, what to import first and when to publish.",
      cta: "Read the guide",
    },
  },
];

const isGroup = (x: NavGroup | NavItem): x is NavGroup => "columns" in x;
const groupItems = (g: NavGroup) => g.columns.flatMap((c) => c.items);

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
          {NAV.map((entry, index) =>
            isGroup(entry) ? (
              <div key={entry.label} className="relative">
                <button
                  type="button"
                  aria-expanded={menu === entry.label}
                  onClick={() => setMenu((m) => (m === entry.label ? null : entry.label))}
                  onMouseEnter={() => setMenu(entry.label)}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-3 py-2 text-[14px] transition-colors",
                    menu === entry.label || groupItems(entry).some((i) => active(i.href)) ? "text-mk-on-dark" : "text-mk-on-dark-2 hover:text-mk-on-dark",
                  )}
                >
                  {entry.label}
                  <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform", menu === entry.label && "rotate-180")} />
                </button>
                {menu === entry.label ? (
                  <div
                    onMouseLeave={() => setMenu(null)}
                    className={cn(
                      "absolute top-full mt-2 flex gap-2 rounded-[12px] border border-white/10 bg-mk-ink-2 p-2 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]",
                      // Menus right of Pricing open leftwards so they stay on screen at 1024px.
                      index > NAV.findIndex((e) => !isGroup(e)) ? "right-0" : "left-0",
                    )}
                  >
                    {entry.columns.map((col, ci) => (
                      <div key={col.heading ?? ci} className="w-[260px] xl:w-[300px]">
                        {col.heading ? (
                          <p className="px-3 pb-1 pt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mk-on-dark-3">{col.heading}</p>
                        ) : null}
                        {col.items.map((item) => (
                          <Link key={item.href} href={item.href} className="block rounded-[8px] px-3 py-2.5 hover:bg-white/5 focus-visible:bg-white/5">
                            <span className="block text-[14px] font-medium text-mk-on-dark">{item.label}</span>
                            {item.note ? <span className="block text-[13px] text-mk-on-dark-3">{item.note}</span> : null}
                          </Link>
                        ))}
                      </div>
                    ))}
                    {entry.card ? (
                      <Link
                        href={entry.card.href}
                        className="group flex w-[200px] flex-col xl:w-[240px] gap-2 rounded-[10px] border border-white/10 bg-white/[0.03] p-4 hover:border-white/20 focus-visible:border-white/30"
                      >
                        <span className="text-[14px] font-medium text-mk-on-dark">{entry.card.title}</span>
                        <span className="text-[13px] leading-relaxed text-mk-on-dark-3">{entry.card.text}</span>
                        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[13px] font-medium text-mk-accent-lit">
                          {entry.card.cta}
                          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    ) : null}
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
          <Link href="/sign-up" className="inline-flex h-9 items-center rounded-[10px] bg-mk-accent px-3.5 text-[14px] font-medium text-white hover:bg-mk-accent-hover">
            Start a 30-day trial
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
                  {entry.columns.map((col, ci) => (
                    <div key={col.heading ?? ci} className={ci > 0 ? "mt-3" : undefined}>
                      {col.heading ? <p className="mb-1 text-[13px] text-mk-on-dark-3">{col.heading}</p> : null}
                      <ul className="grid gap-1">
                        {col.items.map((item) => (
                          <li key={item.href}>
                            <Link href={item.href} className="block py-1.5 text-[15px] text-mk-on-dark hover:text-mk-accent-lit">
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
                  <Link href={entry.href} className="block py-1.5 text-[15px] font-medium text-mk-on-dark hover:text-mk-accent-lit">
                    {entry.label}
                  </Link>
                </div>
              ),
            )}
          </nav>
          <div className="mx-auto flex w-full max-w-[1200px] flex-wrap gap-3 border-t border-white/10 px-5 py-5 sm:px-8">
            <Link href="/sign-up" className="inline-flex h-11 flex-1 items-center justify-center rounded-[10px] bg-mk-accent px-5 text-[15px] font-medium text-white">
              Start a 30-day trial
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
