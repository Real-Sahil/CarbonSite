"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/solutions/construction", label: "Construction" },
  { href: "/solutions/waste-haulage", label: "Waste & Haulage" },
  { href: "/field-app", label: "Field App" },
  { href: "/security", label: "Security" },
  { href: "/resources", label: "Resources" },
];

export function SiteNav({ theme = "light" }: { theme?: "light" | "dark" }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  const dark = theme === "dark" || scrolled;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#0F172A]/92 backdrop-blur-md border-b border-white/6"
            : dark
              ? "bg-transparent border-b border-transparent"
              : "bg-[#F5F4F0]/92 backdrop-blur-md border-b border-[#E2E8F0]"
        }`}
        style={{ height: 60 }}
      >
        <div className="mx-auto max-w-7xl px-6 md:px-10 flex items-center justify-between h-full">
          {/* Wordmark */}
          <Link
            href="/"
            className={`text-[15px] font-semibold tracking-[-0.03em] transition-colors ${
              dark ? "text-white" : "text-[#0F172A]"
            }`}
          >
            CarbonSite
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                  dark
                    ? "text-white/50 hover:text-white hover:bg-white/6"
                    : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#0F172A]/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Auth actions */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/sign-in"
              className={`px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                dark ? "text-white/50 hover:text-white" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors active:scale-[0.97] ${
                dark
                  ? "bg-white text-[#0F172A] hover:bg-white/90"
                  : "bg-[#0F172A] text-white hover:bg-[#1A1A18]"
              }`}
            >
              Start free
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen((o) => !o)}
            className={`md:hidden p-2 rounded-md transition-colors ${
              dark ? "text-white/70 hover:text-white" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduced ? {} : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? {} : { opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-x-0 top-[60px] z-40 bg-[#0F172A] border-b border-white/8 px-6 py-6 md:hidden"
          >
            <nav className="flex flex-col gap-1 mb-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2.5 rounded-md text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-col gap-2 pt-4 border-t border-white/8">
              <Link href="/sign-in" className="px-3 py-2.5 text-sm text-white/50 hover:text-white transition-colors">
                Sign in
              </Link>
              <Link href="/sign-up" className="px-4 py-2.5 rounded-full bg-white text-[#0F172A] text-sm font-medium text-center hover:bg-white/90 transition-colors">
                Start free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
