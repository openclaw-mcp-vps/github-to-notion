import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { Toaster } from "react-hot-toast";

import "@/app/globals.css";
import { cn } from "@/lib/utils";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk"
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono"
});

const baseUrl = "https://github-to-notion.app";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "GitHub to Notion — real-time issue + PR sync with zero config",
  description:
    "Connect one GitHub repo and one Notion database. Sync issues, pull requests, and comments both directions in under 3 seconds.",
  keywords: [
    "GitHub Notion sync",
    "issue sync",
    "pull request sync",
    "Notion automation",
    "indie founder tools"
  ],
  openGraph: {
    title: "GitHub to Notion — real-time issue + PR sync with zero config",
    description:
      "A fast, affordable sync layer for solo founders and tiny teams: one repo, one Notion database, two-way issue + PR sync.",
    url: baseUrl,
    siteName: "GitHub to Notion",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "GitHub to Notion",
    description:
      "Bidirectional GitHub + Notion sync for issues, PRs, and comments in under 3 seconds."
  },
  alternates: {
    canonical: "/"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(
        "dark font-sans",
        spaceGrotesk.variable,
        plexMono.variable
      )}
    >
      <body className="bg-[#0d1117] text-[#e6edf3] antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#161b22",
              color: "#e6edf3",
              border: "1px solid #30363d"
            }
          }}
        />
      </body>
    </html>
  );
}
