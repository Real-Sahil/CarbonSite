import Link from "next/link";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#E2E8F0] px-[42px] py-4 flex items-center justify-between">
        <span
          className="text-base font-light tracking-[-0.48px] text-[#0F172A]"
          
        >
          Fluid Platform
        </span>
        <Link
          href="/"
          className="text-xs text-[#475569] hover:text-[#0F172A] tracking-[-0.36px]"
        >
          &larr; Back to app
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
