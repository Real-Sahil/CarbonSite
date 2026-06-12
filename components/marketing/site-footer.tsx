import Link from "next/link";

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
      { href: "/sign-up", label: "Start free" },
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

export function SiteFooter({ dark = false }: { dark?: boolean }) {
  const bg = dark ? "bg-zinc-950 border-zinc-800" : "bg-zinc-950 border-zinc-800";
  return (
    <footer className={`${bg} border-t`}>
      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="text-lg font-semibold text-white tracking-tight mb-3">CarbonSite</div>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-[200px]">
              GHG emissions tracking for construction and supply chains. DEFRA 2025. GHG Protocol Corporate Standard.
            </p>
          </div>
          {COLS.map((col) => (
            <div key={col.heading}>
              <div className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-4">{col.heading}</div>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-400 hover:text-white transition-colors"
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
        <div className="pt-8 border-t border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm text-zinc-500">
            &copy; {new Date().getFullYear()} CarbonSite. Calculations follow GHG Protocol Corporate Standard, IPCC AR6 GWPs.
          </span>
          <div className="flex items-center gap-4">
            {["GHG Protocol", "DEFRA 2025", "IPCC AR6", "SECR"].map((s) => (
              <span key={s} className="text-xs text-zinc-600 border border-zinc-800 rounded px-2 py-0.5">{s}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
