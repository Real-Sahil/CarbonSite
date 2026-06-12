import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

export function FeatureCard({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[14px] border border-[#e5e7eb] bg-[#fffefc] p-6 flex flex-col gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-[7px] bg-[#b6ced5]">
        <Icon className="h-5 w-5 text-[#0f3e17]" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-medium text-[#0f3e17] mb-1">{title}</h3>
        <p className="text-sm text-[#222222] leading-6 tracking-[-0.42px]">{text}</p>
      </div>
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
    <Link href={href} className="group block rounded-[14px] border border-[#e5e7eb] bg-[#fffefc] p-6 hover:border-[#b1dbb8] hover:bg-[#e1f4df] transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-[#0f3e17] mb-1">{title}</h3>
          <p className="text-sm text-[#222222] leading-6 tracking-[-0.42px]">{text}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-[#0f3e17] mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
      </div>
    </Link>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-[#e5e7eb] mt-14">
      <div className="mx-auto max-w-7xl px-5 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-sm text-[#222222] tracking-[-0.42px]">
          &copy; {new Date().getFullYear()} CarbonSite. Built for construction carbon.
        </span>
        <div className="flex items-center gap-6 text-sm text-[#222222] tracking-[-0.42px]">
          <Link href="/product" className="hover:text-[#0f3e17] transition-colors">Product</Link>
          <Link href="/security" className="hover:text-[#0f3e17] transition-colors">Security</Link>
          <Link href="/sign-in" className="hover:text-[#0f3e17] transition-colors">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
