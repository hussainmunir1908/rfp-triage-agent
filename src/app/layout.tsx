import type { Metadata, Viewport } from "next";
import { Jersey_10, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Schibsted_Grotesk({
  variable: "--f-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const mono = JetBrains_Mono({ variable: "--f-mono", subsets: ["latin"], weight: ["400", "500", "700"] });
const pixel = Jersey_10({ variable: "--f-pixel", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Bidlings // RFP triage",
  description:
    "Upload a government RFP and get an evidence-linked bid or no-bid call you can stress-test before you commit a week to it.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eff2ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${pixel.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
