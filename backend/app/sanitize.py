import html
import re

import nh3

SAFE_TAGS = {"p", "br", "ul", "ol", "li", "strong", "em", "b", "i", "h1", "h2", "h3", "h4", "table", "thead", "tbody", "tr", "td", "th", "a", "span", "div"}


def clean_html(raw: str) -> str:
    """Safe subset of Canvas syllabus HTML for display (no scripts, styles, or event handlers)."""
    return nh3.clean(raw or "", tags=SAFE_TAGS, attributes={"a": {"href"}}, link_rel="noopener noreferrer nofollow")


def html_to_text(raw: str) -> str:
    text = re.sub(r"(?i)<\s*(br|/p|/li|/tr|/h\d|/div)\s*/?>", "\n", raw or "")
    text = nh3.clean(text, tags=set())
    text = html.unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()
