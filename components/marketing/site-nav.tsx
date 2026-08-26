"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { Menu, X, Leaf } from "lucide-react";

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
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  const isDark = theme === "dark";

  return (
    <>
      {/* ── Floating pill nav ────────────────────────────────────────────────── */}
      <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
        <motion.header
          initial={reduced ? {} : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`pointer-events-auto w-full max-w-5xl flex items-center justify-between px-4 h-12 rounded-full border transition-all duration-300 ${
            scrolled || isDark
              ? "bg-[#0A1628]/90 backdrop-blur-xl border-white/10 shadow-[0_4px_32px_rgba(10,22,40,0.45)]"
              : "bg-white/80 backdrop-blur-xl border-black/6 shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
          }`}
        >
          {/* Logo */}
          <Link
            href="/"
            className={`flex items-center gap-1.5 text-[14px] font-semibold tracking-tight shrink-0 transition-colors ${
              scrolled || isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-orange-500 to-amber-400">
              <Leaf className="h-3 w-3 text-white" />
            </span>
            CarbonSite
          </Link>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-full text-[13px] transition-colors ${
                  scrolled || isDark
                    ? "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/8"
                    : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#0F172A]/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Auth actions */}
          <div className="hidden md:flex items-center gap-1.5">
            <Link
              href="/sign-in"
              className={`px-3 py-1.5 rounded-full text-[13px] transition-colors ${
                scrolled || isDark ? "text-[#94A3B8] hover:text-[#F8FAFC]" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-white text-[13px] font-medium shadow-[0_0_16px_rgba(249,115,22,0.35)] hover:shadow-[0_0_24px_rgba(249,115,22,0.5)] hover:from-orange-400 hover:to-amber-300 transition-all active:scale-[0.97]"
            >
              Start free
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen((o) => !o)}
            className={`md:hidden p-1.5 rounded-full transition-colors ${
              scrolled || isDark ? "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/8" : "text-[#64748B] hover:text-[#0F172A] hover:bg-black/5"
            }`}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </motion.header>
      </div>

      {/* ── Mobile drawer ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduced ? {} : { opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? {} : { opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-x-4 top-20 z-40 rounded-2xl border border-white/10 bg-[#0A1628]/97 backdrop-blur-2xl shadow-[0_8px_48px_rgba(10,22,40,0.5)] overflow-hidden md:hidden"
          >
            {/* Mesh blob inside drawer */}
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.15)_0%,transparent_70%)] pointer-events-none" />

            <nav className="relative flex flex-col gap-0.5 p-3">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2.5 rounded-xl text-sm text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/6 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="relative flex flex-col gap-2 p-3 pt-0">
              <div className="h-px bg-white/6 mb-1" />
              <Link href="/sign-in" className="px-4 py-2.5 rounded-xl text-sm text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5 transition-colors">
                Sign in
              </Link>
              <Link href="/sign-up" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-medium text-center shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                Start free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
