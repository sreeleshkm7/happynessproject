from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys


ROOT = Path(__file__).resolve().parent.parent


class PageAudit(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []
        self.ids = set()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "a" and "href" in attrs:
            self.references.append(("link", attrs["href"], tag))
        if tag in {"img", "script", "source", "video", "audio", "iframe"}:
            if attrs.get("src"):
                self.references.append(("asset", attrs["src"], tag))
        if tag == "link" and attrs.get("href"):
            self.references.append(("asset", attrs["href"], tag))
        for match in re.finditer(r"url\((['\"]?)(.*?)\1\)", attrs.get("style", ""), re.I):
            self.references.append(("asset", match.group(2).strip(), "style"))


def main():
    pages = sorted(
        path for path in ROOT.rglob("*.html")
        if not {"archive", "tools"}.intersection(path.relative_to(ROOT).parts)
    )
    broken = []
    missing_images = []
    placeholders = []
    absolute = []
    checked = 0

    for page in pages:
        parser = PageAudit()
        parser.feed(page.read_text(encoding="utf-8", errors="replace"))
        for kind, value, tag in parser.references:
            value = value.strip()
            checked += 1
            if value in {"", "#"}:
                placeholders.append(f"{page.relative_to(ROOT)}: {tag} has {value!r}")
                continue
            if re.match(r"^[A-Za-z]:[\\/]", value) or value.startswith("/"):
                absolute.append(f"{page.relative_to(ROOT)}: {value}")
                continue
            parts = urlsplit(value)
            if parts.scheme or parts.netloc or value.startswith("//"):
                if kind == "asset" and tag == "img" and parts.scheme in {"http", "https"}:
                    missing_images.append(f"{page.relative_to(ROOT)}: remote image remains: {value}")
                continue
            if parts.path:
                destination = (page.parent / unquote(parts.path)).resolve()
                if not destination.is_file():
                    finding = f"{page.relative_to(ROOT)}: {value} -> missing {destination.relative_to(ROOT)}"
                    (missing_images if kind == "asset" and tag == "img" else broken).append(finding)
            if parts.fragment:
                destination = (page.parent / unquote(parts.path)).resolve() if parts.path else page
                if destination.is_file() and destination.suffix == ".html":
                    target_parser = parser if destination == page else PageAudit()
                    if destination != page:
                        target_parser.feed(destination.read_text(encoding="utf-8", errors="replace"))
                    if unquote(parts.fragment) not in target_parser.ids:
                        broken.append(f"{page.relative_to(ROOT)}: missing fragment #{parts.fragment} in {destination.relative_to(ROOT)}")

    for title, findings in (("Broken links/assets", broken), ("Missing or remote images", missing_images), ("Hash placeholders", placeholders), ("Absolute paths", absolute)):
        print(f"{title}: {len(findings)}")
        for finding in findings:
            print(f"  {finding}")
    print(f"Scanned {len(pages)} HTML files and {checked} references.")
    return 1 if broken or missing_images or placeholders or absolute else 0


if __name__ == "__main__":
    sys.exit(main())