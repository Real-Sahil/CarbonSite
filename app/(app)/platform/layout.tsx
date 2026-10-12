import Link from "next/link";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFC]">
      <header className="border-b border-[#E3E8EE] px-4 md:px-[42px] py-4 flex items-center justify-between">
        <span className="font-display text-xl font-light tracking-[-0.02em] text-[#131d29]">
          MetricOra <em className="text-[#C2400C]">Platform</em>
        </span>
        <Link
          href="/"
          className="rounded-full border border-[#131d29]/[0.12] bg-white px-4 py-1.5 text-xs text-[#41505F] hover:text-[#131d29] tracking-[-0.36px]"
        >
          &larr; Back to app
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
