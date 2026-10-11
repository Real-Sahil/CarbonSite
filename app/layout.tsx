import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { MotionProvider } from "@/components/motion-provider";
import { ScrollProvider } from "@/components/scroll-provider";
import { Providers } from "@/components/providers";
import "./globals.css";
import "@designcodeio/threeui/style.css";

export const metadata: Metadata = {
  title: {
    default: "MetricOra | Carbon evidence and reporting for UK contractors",
    template: "%s | MetricOra",
  },
  description:
    "Capture site evidence, calculate Scope 1, 2 and 3 with named DEFRA factors, and publish reports in which every figure can be traced.",
  metadataBase: new URL("https://www.metricora.co.uk"),
  openGraph: {
    type: "website",
    siteName: "MetricOra",
    title: "MetricOra | Carbon evidence and reporting for UK contractors",
    description: "Every tonne traced to a ticket, a factor and a formula.",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "MetricOra" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MetricOra | Carbon evidence and reporting for UK contractors",
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
  // Set these on Vercel with the tokens from Google Search Console and Bing
  // Webmaster Tools (HTML tag method) to verify the domain.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
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
        <SpeedInsights />
      </body>
    </html>
  );
}
