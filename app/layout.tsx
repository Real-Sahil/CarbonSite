import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://carbonsite.app"),
  title: {
    default: "CarbonSite | Construction Carbon Reporting",
    template: "%s | CarbonSite",
  },
  description:
    "Audit-ready carbon reporting for UK construction materials, waste collections, and haulage routes.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg" }],
  },
  openGraph: {
    title: "CarbonSite",
    description:
      "Materials, waste and haulage evidence in one audit-ready construction carbon workspace.",
    url: "/",
    siteName: "CarbonSite",
    images: [{ url: "/carbonsite-site-operations.svg", width: 960, height: 620 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CarbonSite",
    description:
      "Audit-ready carbon reporting for UK construction materials, waste and haulage.",
    images: ["/carbonsite-site-operations.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: "var(--font-inter, Inter, sans-serif)" }}
      >
        {children}
      </body>
    </html>
  );
}
