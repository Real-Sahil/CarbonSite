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
    <footer className="bg-[#0D0D0B] border-t border-[#2A2A27]">
      <div className="mx-auto max-w-7xl px-6 md:px-10 pt-16 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          <div>
            <div className="text-[15px] font-semibold text-white tracking-[-0.03em] mb-4">CarbonSite</div>
            <p className="text-sm text-[#5C5B57] leading-relaxed max-w-[200px]">
              GHG emissions tracking for construction and supply chains. DEFRA 2025. GHG Protocol Corporate Standard.
            </p>
          </div>
          {COLS.map((col) => (
            <div key={col.heading}>
              <div className="text-[10px] font-medium text-[#3D3D3A] uppercase tracking-[0.12em] mb-4">{col.heading}</div>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#5C5B57] hover:text-white transition-colors"
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
        <div className="pt-8 border-t border-[#2A2A27] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <span className="text-xs text-[#3D3D3A]">
            &copy; {new Date().getFullYear()} CarbonSite Ltd. Calculations follow GHG Protocol Corporate Standard, IPCC AR6 GWPs.
          </span>
          <div className="flex items-center gap-3">
            {["GHG Protocol", "DEFRA 2025", "IPCC AR6", "SECR"].map((s) => (
              <span key={s} className="text-[10px] text-[#3D3D3A] border border-[#2A2A27] rounded px-2 py-0.5 tracking-wide">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
