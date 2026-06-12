import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fffefc] px-4 py-[76px]">
      <div className="mb-[42px] flex flex-col items-center gap-[7px]">
        <span
          className="text-2xl text-[#0f3e17] tracking-[-0.72px]"
          style={{
            fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)",
            fontWeight: 300,
          }}
        >
          CarbonSite
        </span>
        <span className="text-xs text-[#222222] font-normal tracking-[-0.36px]">
          GHG Emissions Tracking
        </span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
