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
  // Inline, so no /favicon.ico request 404s: a pale-blue four-point star on the night sky.
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230c1018'/%3E%3Cpath d='M16 4l2.6 9.4L28 16l-9.4 2.6L16 28l-2.6-9.4L4 16l9.4-2.6z' fill='%23a4cbff'/%3E%3C/svg%3E",
  },
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
