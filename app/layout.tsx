import type { Metadata } from "next";
import localFont from "next/font/local";
import Workspace from "@/components/workspace";
import "./globals.css";

// Material 3's typeface, Roboto Flex, for every role (display, title, body, label): one variable file covers every
// weight and optical size, so type can change shape with size (apple-design §15). Self-hosted (latin subset from
// Google Fonts, SIL OFL), since next/font/google fetched at build time and that fetch failed CI intermittently (#226).
// `--font-display` is aliased to it in globals.css, so every panel that uses either name changes without touching
// its files.
const sans = localFont({ src: [{ path: "./fonts/roboto-flex-latin.woff2", weight: "100 1000", style: "normal" }], variable: "--font-sans" });
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
