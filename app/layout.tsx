import type { Metadata } from "next";
import localFont from "next/font/local";
import Workspace from "@/components/workspace";
import "./globals.css";

// An observatory's voice (specs/features/ui-redesign): IBM Plex Sans for reading and headings (globals.css points
// --font-display at it), Plex Mono for controls and the instrument's markings (counts, years, step labels). Self-hosted
// (latin subsets from Google Fonts, SIL OFL), since next/font/google fetched at build time and that failed CI
// intermittently (#226).
const sans = localFont({ src: [{ path: "./fonts/ibm-plex-sans-latin.woff2", weight: "400 600", style: "normal" }], variable: "--font-sans" });
const mono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-500-latin.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Uncharted",
  description: "A galaxy of hackathon projects that helps a team decide what to build.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Workspace />
        {children}
      </body>
    </html>
  );
}
