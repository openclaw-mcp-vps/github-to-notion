import type { Metadata } from "next";
import { Space_Grotesk, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk"
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://github-to-notion.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "GitHub to Notion | Real-time issue + PR sync",
    template: "%s | GitHub to Notion"
  },
  description:
    "Sync one GitHub repo to one Notion database in real time. Issues, pull requests, and comments stay aligned both directions in under 3 seconds.",
  openGraph: {
    title: "GitHub to Notion — real-time issue + PR sync with zero config",
    description:
      "For solo founders and tiny teams. Real-time GitHub + Notion sync for one repo at $12/month.",
    url: appUrl,
    siteName: "GitHub to Notion",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "GitHub to Notion",
    description:
      "Bidirectional issue, PR, and comment sync for one repo and one Notion database."
  },
  keywords: [
    "GitHub Notion sync",
    "issue sync",
    "PR sync",
    "developer productivity",
    "indie hacker tools"
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body className={`${spaceGrotesk.variable} antialiased`}>{children}</body>
    </html>
  );
}
