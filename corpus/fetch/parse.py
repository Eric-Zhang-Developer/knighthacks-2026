"""Parse Devpost gallery and project pages into corpus records. Pure functions: no network."""

import hashlib
import re
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

PROJECT_URL = re.compile(r"^https://devpost\.com/software/[A-Za-z0-9_-]+$")
MAX_DESCRIPTION = 20_000  # characters; a few pages paste whole READMEs


def canonical(url: str) -> str:
    """https://devpost.com/software/<slug>, with no query, fragment or trailing slash."""
    p = urlsplit(url.strip())
    return f"https://{p.netloc.lower()}{p.path.rstrip('/')}"


def parse_gallery(html: str, base_url: str) -> list[str]:
    """Canonical project URLs on one gallery page, in page order, without repeats."""
    soup = BeautifulSoup(html, "html.parser")
    urls = []
    for a in soup.select("a[href]"):
        u = canonical(urljoin(base_url, a["href"]))
        if PROJECT_URL.match(u) and u not in urls:
            urls.append(u)
    return urls


def _text(node) -> str:
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip() if node else ""


def parse_project(html: str, url: str, fetched_at: str, event_dates: dict[str, str] | None = None):
    """(record, None) or (None, rejection reason). Missing optional fields stay None; nothing is filled in."""
    soup = BeautifulSoup(html, "html.parser")
    url = canonical(url)
    title = _text(soup.select_one("#app-title"))
    tagline = _text(soup.select_one("#app-title + p")) or None
    technologies = [_text(t) for t in soup.select("#built-with .cp-tag")]
    details = soup.select_one("#app-details-left")
    if details:
        for extra in details.select("#built-with, nav, .app-links"):
            extra.decompose()  # tags and "Try it out" links aren't the description
    description = _text(details)[:MAX_DESCRIPTION]
    if not title:
        return None, "no title"
    if not description:
        return None, "no description"

    events = []
    for item in soup.select("#submissions .software-list-content"):
        link = item.select_one("p a[href]")
        if not link:
            continue
        event_url = canonical(link["href"])
        events.append({
            "name": _text(link),
            "url": event_url,
            "dates": (event_dates or {}).get(event_url),  # from the hackathon API; None when unknown
            "prizes": [_text(li).removeprefix("Winner").strip() for li in item.select("li") if li.select_one(".winner")],
        })
    # Devpost's markup closes #app-team early in a lenient parser, so find the author line by its words.
    created = next((t for t in soup.select("p.author time[datetime]")
                    if "started this project" in _text(t.find_parent("p"))), None)
    return {
        "id": hashlib.sha1(url.encode()).hexdigest(),
        "url": url,
        "title": title,
        "tagline": tagline,
        "description": description,
        "technologies": technologies,
        "events": events,
        "date": created["datetime"] if created else None,
        "date_kind": "created" if created else "unknown",  # Devpost shows when the project was started, not submitted
        "source": "devpost",
        "fetched_at": fetched_at,
        "content_hash": hashlib.sha256(f"{title}\n{tagline or ''}\n{description}".encode()).hexdigest(),
    }, None
