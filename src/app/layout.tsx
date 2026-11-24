import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Silkscreen, Space_Grotesk } from "next/font/google";
import "./globals.css";

const space = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const plex = IBM_Plex_Mono({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });
const silk = Silkscreen({ variable: "--font-silk", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "RFP Triage Agent // idiaz.io",
  description: "Upload a government RFP and get an evidence-linked bid or no-bid recommendation.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f5f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${space.variable} ${plex.variable} ${silk.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
