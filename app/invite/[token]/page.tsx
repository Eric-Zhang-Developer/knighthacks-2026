import type { Metadata } from "next";
import Join from "@/components/workspace/Join";

// Invite links are capabilities: keep them out of search indexes and referrers.
export const metadata: Metadata = { title: "Join a workspace · Golden Egg", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <Join token={token} />;
}
