import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { MotionProvider } from "@/components/motion-provider";
import { ScrollProvider } from "@/components/scroll-provider";
import { Providers } from "@/components/providers";
import "./globals.css";
import "@designcodeio/threeui/style.css";

export const metadata: Metadata = {
  title: {
    default: "MetricOra | Measure what matters.",
    template: "%s | MetricOra",
  },
  description:
    "Multi-tenant GHG emissions tracking for construction and supply chains. Import activity data, run calculations to DEFRA 2025 and GHG Protocol standards, generate audit-ready reports.",
  metadataBase: new URL("https://www.metricora.co.uk"),
  openGraph: {
    type: "website",
    siteName: "MetricOra",
    title: "MetricOra | Measure what matters.",
    description:
      "GHG emissions tracking for construction and supply chains. Audit-ready reports in minutes.",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "MetricOra" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MetricOra | Measure what matters.",
    images: ["/og-default.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: { url: "/icon-180.png", sizes: "180x180", type: "image/png" },
    shortcut: "/icon-48.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <ScrollProvider>
            <MotionProvider>{children}</MotionProvider>
          </ScrollProvider>
        </Providers>
      </body>
    </html>
  );
}
