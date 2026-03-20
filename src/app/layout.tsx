import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Share_Tech_Mono, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-share-tech",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | AXIOM Intelligence",
    default: "AXIOM — Geopolitical Risk Intelligence",
  },
  description:
    "Institutional-grade geopolitical risk intelligence. Real-time signal monitoring, AI-powered scenario simulation, and portfolio exposure analysis.",
  keywords: [
    "geopolitical risk",
    "political risk intelligence",
    "scenario simulation",
    "risk analytics",
    "institutional intelligence",
  ],
  authors: [{ name: "AXIOM Intelligence" }],
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080c12",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${shareTechMono.variable} ${barlowCondensed.variable}`}
      suppressHydrationWarning
    >
      <body className="font-ui antialiased bg-axiom-body text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
