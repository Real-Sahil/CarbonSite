"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CarbonSite] Org page error:", error);
  }, [error]);

  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fffefc] p-6">
      <div className="text-center max-w-md">
        <h1
          className="text-[32px] leading-tight text-[#0f3e17] mb-3"
          style={{ fontFamily: "var(--font-fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          Something went wrong
        </h1>
        <p className="text-sm text-[#555] mb-2 leading-relaxed">
          There was a problem loading this page. This is usually a temporary issue.
        </p>
        {error.digest && (
          <p className="text-xs text-[#888] mb-6">
            Reference: <code className="bg-[#f0f0f0] px-1.5 py-0.5 rounded text-[11px]">{error.digest}</code>
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-[#0f3e17] text-white rounded-lg text-sm font-medium hover:bg-[#0d3514] transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => router.push("/")}
            className="px-5 py-2.5 bg-[#e1f4df] text-[#0f3e17] rounded-lg text-sm font-medium hover:bg-[#d0ecce] transition-colors"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
