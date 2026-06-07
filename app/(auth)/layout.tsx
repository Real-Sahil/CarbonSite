import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <span className="text-2xl font-bold text-green-700 tracking-tight">
          CarbonSite
        </span>
        <span className="text-sm text-slate-500">GHG Emissions Tracking</span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
