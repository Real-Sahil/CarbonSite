import Link from "next/link";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#E5E7EB] px-[42px] py-4 flex items-center justify-between">
        <span
          className="text-base font-light tracking-[-0.48px] text-[#111827]"
          
        >
          Fluid Platform
        </span>
        <Link
          href="/"
          className="text-xs text-[#374151] hover:text-[#111827] tracking-[-0.36px]"
        >
          &larr; Back to app
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
