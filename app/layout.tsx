import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { preconnect } from "react-dom";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ScrollProvider } from "@/components/scroll-provider";
import { Providers } from "@/components/providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme/preference";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Daylight display face: light weight for headings, italic for the accent word.
const newsreader = Newsreader({ subsets: ["latin"], weight: ["300", "400"], style: ["normal", "italic"], variable: "--font-newsreader", display: "swap" });

// Executive Summary face (components/earthy). The browser downloads it only when a rule on the page asks for it.
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap", preload: false });

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
  // Webmaster Tools (HTML tag method) to verify the domain. The Meta tag is a
  // public domain-verification token, rendered server-side into <head>.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: {
      "facebook-domain-verification": "709h8z5b7h1gl21hdb12e8cfiqcu9i",
      ...(process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : {}),
    },
  },
};

// The browser Sentry client reports to this host; opening the connection early keeps it off the critical path.
function sentryOrigin(): string | null {
  try {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
    return dsn ? new URL(dsn).origin : null;
  } catch {
    return null;
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sentry = sentryOrigin();
  if (sentry) preconnect(sentry);
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} ${GeistMono.variable} ${GeistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Before first paint: picks the org app's saved theme (see lib/theme/preference.ts). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Providers>
          <ScrollProvider>
            {children}
          </ScrollProvider>
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
