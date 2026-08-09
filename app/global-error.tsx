"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CarbonSite] Uncaught error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", background: "#F8FAFC", color: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 480, padding: "0 24px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#0F172A", marginBottom: 12 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#475569", marginBottom: 28, lineHeight: 1.6 }}>
            A server error occurred loading this page.
            {error.digest && (
              <> Reference: <code style={{ fontSize: 12, background: "#F1F5F9", padding: "2px 5px", borderRadius: 4 }}>{error.digest}</code></>
            )}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{ padding: "10px 20px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{ padding: "10px 20px", background: "#EEF2FF", color: "#4F46E5", borderRadius: 8, fontSize: 14, textDecoration: "none", display: "inline-block" }}
            >
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
