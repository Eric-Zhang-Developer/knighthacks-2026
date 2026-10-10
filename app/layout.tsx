import type { Metadata } from "next";
import localFont from "next/font/local";
import Workspace from "@/components/workspace";
import "./globals.css";

// A star chart's voice: engraved serif headings, a plain sans for reading, mono for the chart's annotations.
// Self-hosted (latin subset from Google Fonts, SIL OFL): next/font/google fetched these at build time, and that
// fetch failed CI intermittently (#226). Cormorant and Plex Sans are variable fonts, so one file covers each weight range.
const display = localFont({
  src: [
    { path: "./fonts/cormorant-garamond-latin.woff2", weight: "500 600", style: "normal" },
    { path: "./fonts/cormorant-garamond-italic-latin.woff2", weight: "500 600", style: "italic" },
  ],
  variable: "--font-display",
});
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
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <Workspace />
        {children}
      </body>
    </html>
  );
}
