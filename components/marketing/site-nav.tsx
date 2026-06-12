"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
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
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isDark = theme === "dark";
  const navBg = scrolled
    ? "bg-zinc-950/90 backdrop-blur-md border-zinc-800"
    : isDark
      ? "bg-transparent border-transparent"
      : "bg-slate-50/90 backdrop-blur-md border-zinc-200";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${navBg}`}
      style={{ height: 64 }}
    >
      <div className="mx-auto max-w-7xl px-5 h-full flex items-center justify-between gap-8">
        <Link
          href="/"
          className={`text-xl font-semibold tracking-tight ${scrolled || isDark ? "text-white" : "text-zinc-900"}`}
        >
          CarbonSite
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                scrolled || isDark
                  ? "text-zinc-400 hover:text-white"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/sign-in"
            className={`text-sm px-4 py-2 rounded-lg transition-colors ${
              scrolled || isDark
                ? "text-zinc-400 hover:text-white"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-sm px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors active:scale-[0.97]"
          >
            Start free
          </Link>
        </div>

        <button
          className={`md:hidden p-2 rounded-lg ${scrolled || isDark ? "text-zinc-400" : "text-zinc-600"}`}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <motion.div
          initial={prefersReduced ? {} : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="md:hidden bg-zinc-950 border-t border-zinc-800 px-5 py-4 flex flex-col gap-1"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-sm text-zinc-300 hover:text-white py-2 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-zinc-800 mt-2 flex flex-col gap-2">
            <Link href="/sign-in" className="text-sm text-zinc-400 py-2">Sign in</Link>
            <Link href="/sign-up" className="text-sm px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-center">
              Start free
            </Link>
          </div>
        </motion.div>
      )}
    </header>
  );
}
