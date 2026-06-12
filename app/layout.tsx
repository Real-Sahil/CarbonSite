import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { MotionProvider } from "@/components/motion-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CarbonSite | GHG Emissions Tracking",
  description:
    "Multi-tenant GHG emissions tracking for construction and supply chains. Import activity data, run calculations to DEFRA 2025 and GHG Protocol standards, generate audit-ready reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: "var(--font-inter, Inter, ui-sans-serif, sans-serif)" }}
      >
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
