import Link from "next/link";
import { Leaf } from "lucide-react";

const COLS = [
  {
    heading: "Platform",
    links: [
      { href: "/product", label: "Product overview" },
      { href: "/solutions/construction", label: "Construction" },
      { href: "/solutions/waste-haulage", label: "Waste and haulage" },
      { href: "/field-app", label: "Field app" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/security", label: "Security" },
      { href: "/resources", label: "Resources" },
      { href: "/contact", label: "Contact" },
      { href: "/sign-in", label: "Sign in" },
    ],
  },
  {
    heading: "Standards",
    links: [
      { href: "https://ghgprotocol.org", label: "GHG Protocol", external: true },
      { href: "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting", label: "DEFRA 2025", external: true },
      { href: "https://www.epa.gov/climateleadership/ghg-emission-factors-hub", label: "EPA GHG Hub", external: true },
      { href: "https://www.ipcc.ch/report/ar6/wg1/", label: "IPCC AR6", external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#0A1628] border-t border-white/10">
      {/* Ambient mesh */}
      <div className="absolute bottom-0 left-0 w-[500px] h-[300px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.07)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute top-0 right-1/3 w-[400px] h-[250px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.04)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-10 pt-16 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4 w-fit">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 shadow-[0_0_12px_rgba(249,115,22,0.35)]">
                <Leaf className="h-3.5 w-3.5 text-white" />
              </span>
              <span className="text-[#F8FAFC] font-semibold text-[14px] tracking-tight">CarbonSite</span>
            </Link>
            <p className="text-sm text-[#94A3B8] leading-relaxed max-w-[200px]">
              GHG emissions tracking for construction and supply chains. DEFRA 2025. GHG Protocol Corporate Standard.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.heading}>
              <div className="text-[10px] font-mono text-[#64748B] uppercase tracking-[0.14em] mb-4">{col.heading}</div>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
                      {...("external" in link && link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <span className="text-xs text-[#64748B]">
            &copy; {new Date().getFullYear()} CarbonSite Ltd. Calculations follow GHG Protocol Corporate Standard, IPCC AR6 GWPs.
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {["GHG Protocol", "DEFRA 2025", "IPCC AR6", "SECR"].map((s) => (
              <span key={s} className="text-[10px] text-amber-400/60 border border-amber-500/15 rounded-full px-2.5 py-0.5 tracking-wide">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
