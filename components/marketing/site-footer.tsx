import Link from "next/link";
import { GooglePlayBadge, StripeNote } from "@/components/marketing/brand-marks";
import { LogoMark } from "@/components/ui/logo";

const COLS = [
  {
    heading: "Platform",
    links: [
      { href: "/product", label: "Platform overview" },
      { href: "/field-app", label: "Field app" },
      { href: "/pricing", label: "Pricing" },
      { href: "/methodology", label: "Methodology" },
    ],
  },
  {
    heading: "Solutions",
    links: [
      { href: "/solutions/construction", label: "Main contractors" },
      { href: "/solutions/waste-haulage", label: "Waste and haulage" },
      { href: "/solutions/public-sector", label: "Public-sector suppliers" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/security", label: "Security" },
      { href: "/blog", label: "Blog" },
      { href: "/resources", label: "Guides" },
      { href: "/developer", label: "Developers" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/cookies", label: "Cookie policy" },
      { href: "/dpa", label: "Data processing" },
      { href: "/acceptable-use", label: "Acceptable use" },
      { href: "/eula", label: "Mobile app licence" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-mk-ink text-mk-on-dark">
      <div className="mx-auto w-full max-w-[1200px] px-5 pb-10 pt-16 sm:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2">
            <Link href="/" className="flex w-fit items-center gap-2 text-[15px] font-semibold tracking-tight">
              <LogoMark size={24} />
              MetricOra
            </Link>
            <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-mk-on-dark-2">
              Evidence, carbon accounting and reporting for UK contractors and their supply chains.
            </p>
            <p className="mt-4 text-[14px] text-mk-on-dark-2">
              <a href="mailto:hello@metricora.co.uk" className="hover:text-mk-on-dark">
                hello@metricora.co.uk
              </a>
            </p>
            <div className="mt-6 flex flex-col items-start gap-3">
              <GooglePlayBadge />
              <StripeNote tone="dark" />
            </div>
          </div>
          {COLS.map((col) => (
            <div key={col.heading}>
              <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.12em] text-mk-on-dark-3">{col.heading}</p>
              <ul className="grid gap-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[14px] text-mk-on-dark-2 transition-colors hover:text-mk-on-dark">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-8 text-[13px] text-mk-on-dark-3 md:flex-row md:items-center md:justify-between">
          <span>&copy; {new Date().getFullYear()} MetricOra Ltd.</span>
          <span>Emission factors: DESNZ/DEFRA (Open Government Licence v3.0), US EPA, ADEME Base Carbone (Licence Ouverte 2.0).</span>
        </div>
      </div>
    </footer>
  );
}
