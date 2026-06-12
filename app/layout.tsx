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
  title: "CarbonSite | GHG Emissions Tracking",
  description:
    "Multi-tenant GHG emissions tracking platform for small-to-mid-market companies. Import activity data, run calculations, and generate audit-ready reports.",
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
