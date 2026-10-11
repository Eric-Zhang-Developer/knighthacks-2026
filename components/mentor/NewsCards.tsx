import { ClaimBadge } from "@/components/ui";
import styles from "./mentor.module.css";

type InferredRelevance = { text: string; label: "inferred"; sourceIds: string[] };
export type MentorNews = {
  query: string;
  asOf: string;
  windowStart: string;
  model: string;
  items: {
    claim: { text: string; label: "supported"; sourceIds: string[] };
    source: { id: string; title: string; url: string };
    publishedAt: string;
    relevance?: string | InferredRelevance;
  }[];
  limitations: string[];
};

function safeUrl(raw: string) {
  try {
    const url = new URL(raw);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export default function NewsCards({ news }: { news: MentorNews | null }) {
  if (!news) return null;
  return <section className={styles.panel} aria-label="Recent problem news">
    <span className={styles.eyebrow}>RECENT PROBLEM NEWS · LAST 7 DAYS</span>
    <h3>What changed recently</h3>
    <p className={styles.fine}>Fresh search as of <time dateTime={news.asOf}>{news.asOf.slice(0, 10)}</time>. Window begins <time dateTime={news.windowStart}>{news.windowStart.slice(0, 10)}</time>.</p>
    {news.items.length ? news.items.map((item) => {
      const href = safeUrl(item.source.url);
      const relevance = typeof item.relevance === "string" ? item.relevance : item.relevance?.text;
      return <article key={item.source.id} className={styles.proposal}>
        <span className={styles.eyebrow}><time dateTime={item.publishedAt}>{item.publishedAt.slice(0, 10)}</time></span>
        <h3>{item.source.title || "Untitled source"}</h3>
        <p><ClaimBadge label="supported" /> {item.claim.text}</p>
        {relevance ? <p><ClaimBadge label="inferred" /> {relevance}</p> : null}
        {href ? <a href={href} target="_blank" rel="noopener noreferrer">Read source ↗</a> : <p className={styles.fine}>Source link unavailable</p>}
      </article>;
    }) : <p>No relevant news with a verified publication date was found in this seven-day window.</p>}
    {news.limitations.length ? <ul>{news.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul> : null}
  </section>;
}
