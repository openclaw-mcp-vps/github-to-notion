import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";

import { ToasterProvider } from "@/components/ToasterProvider";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk"
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600"]
});

const metadataBase =
  process.env.APP_BASE_URL && process.env.APP_BASE_URL.startsWith("http")
    ? new URL(process.env.APP_BASE_URL)
    : new URL("http://localhost:3000");

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "GitHub to Notion",
    template: "%s | GitHub to Notion"
  },
  description:
    "Real-time GitHub to Notion sync for solo builders. Keep issues, pull requests, and comments mirrored both directions in under 3 seconds.",
  keywords: [
    "GitHub Notion sync",
    "Notion issue tracker",
    "GitHub webhook automation",
    "indie hacker productivity",
    "pull request sync"
  ],
  openGraph: {
    title: "GitHub to Notion — real-time issue + PR sync",
    description:
      "Connect one repo and one Notion database. Sync issues, PRs, and comments both directions in under 3 seconds.",
    url: "/",
    siteName: "GitHub to Notion",
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "GitHub to Notion",
    description: "Fast two-way issue + PR sync for solo builders."
  },
  alternates: {
    canonical: "/"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
      <body className="bg-[#0d1117] text-slate-100 antialiased" style={{ fontFamily: "var(--font-space-grotesk)" }}>
        <ToasterProvider />
        {children}
      </body>
    </html>
  );
}
