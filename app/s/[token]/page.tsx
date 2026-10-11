import type { Metadata } from "next";
import SharedSnapshot from "@/components/share/SharedSnapshot";

// Unlisted: a share link is for the people it's sent to.
export const metadata: Metadata = { title: "Golden Egg · shared idea", robots: { index: false, follow: false } };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  return <SharedSnapshot token={(await params).token} />;
}
