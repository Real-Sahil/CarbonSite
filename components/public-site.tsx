import Image from "next/image";
import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const publicNav = [
  { href: "/product", label: "Product" },
  { href: "/solutions/construction", label: "Construction" },
  { href: "/solutions/waste-haulage", label: "Waste and haulage" },
  { href: "/field-app", label: "Field app" },
  { href: "/security", label: "Security" },
  { href: "/resources", label: "Resources" },
  { href: "/contact", label: "Contact" },
];

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#f4f7f1] text-slate-950">
      <PublicHeader />
      {children}
      <PublicFooter />
    </main>
  );
}

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-900/10 bg-[#f4f7f1]/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" aria-label="CarbonSite home" className="shrink-0">
          <Image src="/carbonsite-logo.svg" alt="CarbonSite" width={184} height={40} priority />
        </Link>
        <nav className="hidden items-center gap-1 rounded-full border border-slate-200/90 bg-white/70 p-1 text-sm font-medium text-slate-600 shadow-sm lg:flex">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 hover:bg-slate-950 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">
              Start pilot
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-900/10 bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-[1fr_2fr]">
        <div>
          <Image src="/carbonsite-logo.svg" alt="CarbonSite" width={158} height={34} />
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
            CarbonSite connects evidence, route distance, review work, calculations, and reports for UK construction carbon operations.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <FooterGroup
            title="Platform"
            links={[
              { href: "/product", label: "Product" },
              { href: "/field-app", label: "Field app" },
              { href: "/security", label: "Security" },
            ]}
          />
          <FooterGroup
            title="Workflows"
            links={[
              { href: "/solutions/construction", label: "Construction" },
              { href: "/solutions/waste-haulage", label: "Waste and haulage" },
              { href: "/product#field-capture", label: "Field capture" },
              { href: "/product#route-distance", label: "Route distance" },
            ]}
          />
          <FooterGroup
            title="Access"
            links={[
              { href: "/sign-in", label: "Workspace sign in" },
              { href: "/sign-up", label: "Create organisation" },
              { href: "/contact", label: "Pilot contact" },
            ]}
          />
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <div className="mt-3 grid gap-2 text-sm text-slate-300">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-white">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  text,
  image,
  imageAlt,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  image: string;
  imageAlt: string;
  children?: ReactNode;
}) {
  return (
    <section className="surface-grid relative mx-auto grid max-w-7xl gap-10 px-5 pb-14 pt-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(460px,1.1fr)] lg:items-center">
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
      <div>
        <p className="inline-flex rounded-full border border-emerald-900/10 bg-white/80 px-3 py-1 text-sm font-semibold text-emerald-900 shadow-sm">
          {eyebrow}
        </p>
        <h1 className="text-balance mt-5 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.02em] text-slate-950 md:text-6xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{text}</p>
        {children && <div className="mt-8">{children}</div>}
      </div>
      <div className="relative">
        <div className="absolute -inset-4 rounded-[1.25rem] bg-emerald-900/10 blur-3xl" />
        <Image
          src={image}
          alt={imageAlt}
          width={960}
          height={620}
          priority
          className="relative rounded-xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.16)]"
        />
      </div>
    </section>
  );
}

export function FeatureCard({
  icon: Icon,
  title,
  text,
}: {
  icon: ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="pressable rounded-xl border border-slate-200/80 bg-white/82 p-5 shadow-sm hover:-translate-y-0.5 hover:border-emerald-900/20 hover:shadow-[0_22px_50px_rgba(15,23,42,0.08)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-900">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

export function LinkedPanel({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link href={href} className="pressable group rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:border-emerald-900/30 hover:shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
        Open page
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
