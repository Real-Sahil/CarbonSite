import Image from "next/image";
import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const publicNav = [
  { href: "/product", label: "Product" },
  { href: "/solutions/construction", label: "Construction" },
  { href: "/security", label: "Security" },
  { href: "/resources", label: "Resources" },
  { href: "/contact", label: "Contact" },
];

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[#f7f9f4] text-slate-950">
      <PublicHeader />
      {children}
      <PublicFooter />
    </main>
  );
}

export function PublicHeader() {
  return (
    <header className="border-b border-slate-200 bg-[#f7f9f4]/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" aria-label="CarbonSite home" className="shrink-0">
          <Image src="/carbonsite-logo.svg" alt="CarbonSite" width={184} height={40} priority />
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 lg:flex">
          {publicNav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-slate-950">
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
    <footer className="border-t border-slate-200 bg-[#f7f9f4]">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[1fr_2fr]">
        <div>
          <Image src="/carbonsite-logo.svg" alt="CarbonSite" width={158} height={34} />
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">
            CarbonSite connects evidence, route distance, review work, calculations, and reports for UK construction carbon operations.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <FooterGroup title="Platform" links={publicNav.slice(0, 3)} />
          <FooterGroup
            title="Workflows"
            links={[
              { href: "/product#field-capture", label: "Field capture" },
              { href: "/product#route-distance", label: "Route distance" },
              { href: "/product#reporting", label: "Reporting" },
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
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      <div className="mt-3 grid gap-2 text-sm text-slate-600">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-slate-950">
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
    <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(460px,1.08fr)] lg:items-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-green-800">{eyebrow}</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight text-slate-950 md:text-6xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{text}</p>
        {children && <div className="mt-8">{children}</div>}
      </div>
      <Image
        src={image}
        alt={imageAlt}
        width={960}
        height={620}
        priority
        className="rounded-xl border border-slate-200 bg-white shadow-sm"
      />
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
    <div className="rounded-lg border border-slate-200 bg-[#fbfcf8] p-5">
      <Icon className="h-5 w-5 text-green-800" />
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
    <Link href={href} className="group rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-green-700">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-green-800">
        Open page
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
