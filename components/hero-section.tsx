"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4";

const HEADING_LINES = ["Shaping tomorrow", "with vision and action."];

const NAV_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/solutions/construction", label: "Construction" },
  { href: "/solutions/waste-haulage", label: "Waste & Haulage" },
  { href: "/field-app", label: "Field App" },
];

function AnimatedHeading() {
  const [charStates, setCharStates] = useState<boolean[][]>(
    HEADING_LINES.map((line) => new Array(line.length).fill(false)),
  );

  useEffect(() => {
    const CHAR_DELAY = 30;
    const INITIAL_DELAY = 200;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    HEADING_LINES.forEach((line, lineIndex) => {
      const lineOffset = HEADING_LINES.slice(0, lineIndex).reduce(
        (sum, l) => sum + l.length,
        0,
      );

      Array.from(line).forEach((_, charIndex) => {
        const delay = INITIAL_DELAY + (lineOffset + charIndex) * CHAR_DELAY;
        const t = setTimeout(() => {
          setCharStates((prev) => {
            const next = prev.map((row) => [...row]);
            next[lineIndex][charIndex] = true;
            return next;
          });
        }, delay);
        timeouts.push(t);
      });
    });

    return () => timeouts.forEach(clearTimeout);
  }, []);

  return (
    <h1
      className="font-normal mb-4 text-4xl md:text-5xl lg:text-6xl xl:text-7xl text-white"
      style={{ letterSpacing: "-0.04em" }}
    >
      {HEADING_LINES.map((line, lineIndex) => (
        <span key={lineIndex} className="block">
          {Array.from(line).map((char, charIndex) => (
            <span
              key={charIndex}
              className="inline-block transition-all duration-500"
              style={{
                opacity: charStates[lineIndex]?.[charIndex] ? 1 : 0,
                transform: charStates[lineIndex]?.[charIndex]
                  ? "translateX(0)"
                  : "translateX(-18px)",
              }}
            >
              {char === " " ? " " : char}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

function FadeIn({
  children,
  delay,
  duration = 1000,
}: {
  children: React.ReactNode;
  delay: number;
  duration?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className="transition-opacity"
      style={{
        opacity: visible ? 1 : 0,
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden bg-black text-white">
      {/* Video background — raw, no overlay */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        src={VIDEO_URL}
      />

      {/* Navbar */}
      <div className="relative z-10 px-6 md:px-12 lg:px-16 pt-6">
        <nav className="liquid-glass rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-2xl font-semibold tracking-tight text-white">
            CarbonSite
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/80">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-gray-300 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <Link
            href="/sign-up"
            className="bg-white text-black px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Start a pilot
          </Link>
        </nav>
      </div>

      {/* Hero content — bottom of viewport */}
      <div className="relative z-10 flex-1 flex flex-col justify-end px-6 md:px-12 lg:px-16 pb-12 lg:pb-16">
        <div className="lg:grid lg:grid-cols-2 lg:items-end gap-8">
          {/* Left: heading, sub, CTA */}
          <div>
            <AnimatedHeading />

            <FadeIn delay={800} duration={1000}>
              <p className="text-base md:text-lg text-gray-300 mb-5">
                Audit-ready carbon data from site activity — connecting field
                evidence, route distance, and board-ready reports for
                construction teams.
              </p>
            </FadeIn>

            <FadeIn delay={1200} duration={1000}>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/sign-up"
                  className="bg-white text-black px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  Create organisation
                </Link>
                <Link
                  href="/product"
                  className="liquid-glass border border-white/20 text-white px-8 py-3 rounded-lg font-medium hover:bg-white hover:text-black transition-colors"
                >
                  Explore product
                </Link>
              </div>
            </FadeIn>
          </div>

          {/* Right: tag line */}
          <FadeIn delay={1400} duration={1000}>
            <div className="flex items-end justify-start lg:justify-end mt-8 lg:mt-0">
              <div className="liquid-glass border border-white/20 px-6 py-3 rounded-xl">
                <p className="text-lg md:text-xl lg:text-2xl font-light text-white">
                  Evidence. Calculation. Reporting.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
