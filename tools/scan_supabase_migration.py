from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parent.parent
# Retired HTML snapshots under archive/ are not part of the deployed application.
SKIP_DIRS = {".git", "archive", "node_modules", ".venv"}
LEGACY_KEYS = re.compile(r"""localStorage\s*\.\s*(?:getItem|setItem|removeItem)\s*\(\s*['"](?:loggedIn|username|wishlist|cart|checkout|bookings)['"]""", re.I)
OLD_TRIP_DATA = re.compile(
    r"Rajasthan Forts|Kerala Backwaters|Gokarna Sunset|"
    r"Joined the Meghalaya trip solo|Chandratal lake stargazing|"
    r"\b\d+\s+upcoming trips\b|data-trip-id\s*=\s*['\"][0-9a-f-]{36}['\"]",
    re.I,
)
OBSOLETE_TRIPS = re.compile(r"HAPPINESS_TRIPS|trips\.js", re.I)
SERVICE_ROLE = re.compile(r"service[_-]?role", re.I)
SENSITIVE_LOG = re.compile(r"console\.log\s*\([^)]*(?:secret|service[_-]?role|anon[_-]?key|password|token)", re.I)
INNER_HTML_ASSIGNMENT = re.compile(r"\b[\w.]+\.innerHTML\s*=\s*(.*?);", re.S)
INTERPOLATION = re.compile(r"\$\{([^{}]*)\}")
SAFE_INTERPOLATIONS = {
    "index",
    "label",
    "fields",
    "type",
    "travellers",
    "statusClass",
    "bookings.length",
    "bookings.length === 1 ? '' : 's'",
}
ESCAPED_INTERPOLATION = re.compile(
    r"(?:\b(?:escapeHtml|encodeURIComponent|Number|money|formatMoney|formatPrice)\s*\(|"
    r"\b[\w.]+\s*===\s*'[^']*'\s*\?)"
)
NUMERIC_INTERPOLATION = re.compile(r"^\(?[\w. *()+/-]+\)?\.toLocaleString\s*\(")


def source_files():
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".html", ".js"}:
            continue
        if SKIP_DIRS.intersection(path.relative_to(ROOT).parts):
            continue
        yield path


def scan():
    findings = []
    files = sorted(source_files())
    for path in files:
        source = path.read_text(encoding="utf-8", errors="replace")
        relative = path.relative_to(ROOT)
        for line_number, line in enumerate(source.splitlines(), 1):
            checks = (
                (LEGACY_KEYS, "legacy localStorage key"),
                (OLD_TRIP_DATA, "hardcoded trip catalogue data"),
                (OBSOLETE_TRIPS, "obsolete trips.js/catalog reference"),
                (SERVICE_ROLE, "service_role text in frontend source"),
                (SENSITIVE_LOG, "console.log may expose sensitive data"),
            )
            for pattern, description in checks:
                if pattern.search(line):
                    findings.append(f"{relative}:{line_number}: {description}")

        for match in INNER_HTML_ASSIGNMENT.finditer(source):
            line_number = source.count("\n", 0, match.start()) + 1
            for expression in INTERPOLATION.findall(match.group(1)):
                normalized = expression.strip()
                if (
                    normalized in SAFE_INTERPOLATIONS
                    or ESCAPED_INTERPOLATION.search(normalized)
                    or NUMERIC_INTERPOLATION.search(normalized)
                ):
                    continue
                findings.append(
                    f"{relative}:{line_number}: review unescaped innerHTML interpolation: {normalized}"
                )
    return files, findings


def main():
    files, findings = scan()
    print(f"Scanned {len(files)} HTML/JS files.")
    print(f"Findings: {len(findings)}")
    for finding in findings:
        print(f"  {finding}")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
