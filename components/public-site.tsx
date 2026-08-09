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
    <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-6 flex flex-col gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-[7px] bg-[#EEF2FF]">
        <Icon className="h-5 w-5 text-[#0F172A]" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-medium text-[#0F172A] mb-1">{title}</h3>
        <p className="text-sm text-[#475569] leading-6 tracking-[-0.42px]">{text}</p>
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
    <Link href={href} className="group block rounded-[14px] border border-[#E2E8F0] bg-white p-6 hover:border-[#C7D2FE] hover:bg-[#EEF2FF] transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-[#0F172A] mb-1">{title}</h3>
          <p className="text-sm text-[#475569] leading-6 tracking-[-0.42px]">{text}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-[#0F172A] mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
      </div>
    </Link>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-[#E2E8F0] mt-14">
      <div className="mx-auto max-w-7xl px-5 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-sm text-[#475569] tracking-[-0.42px]">
          &copy; {new Date().getFullYear()} CarbonSite. Built for construction carbon.
        </span>
        <div className="flex items-center gap-6 text-sm text-[#475569] tracking-[-0.42px]">
          <Link href="/product" className="hover:text-[#0F172A] transition-colors">Product</Link>
          <Link href="/security" className="hover:text-[#0F172A] transition-colors">Security</Link>
          <Link href="/sign-in" className="hover:text-[#0F172A] transition-colors">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
