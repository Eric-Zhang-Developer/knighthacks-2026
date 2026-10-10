import type { Metadata } from "next";
import Workspace from "@/components/workspace";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uncharted",
  description: "A galaxy of hackathon projects that helps a team decide what to build.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Workspace />
        {children}
      </body>
    </html>
  );
}
