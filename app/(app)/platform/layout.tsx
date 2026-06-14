import Link from "next/link";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fffefc]">
      <header className="border-b border-[#e5e7eb] px-[42px] py-4 flex items-center justify-between">
        <span
          className="text-base font-light tracking-[-0.48px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)" }}
        >
          Fluid Platform
        </span>
        <Link
          href="/"
          className="text-xs text-[#222222] hover:text-[#0f3e17] tracking-[-0.36px]"
        >
          &larr; Back to app
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
