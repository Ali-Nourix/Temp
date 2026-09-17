#!/usr/bin/env python3
"""Inline the shared assets into each catalog source, producing files that
open straight from disk with nothing alongside them.

A source in src/ links the shared CSS and JS the ordinary way, so it stays
editable and diffable. Building replaces those two tags with the asset's
contents and writes the result to the repository root, where every catalog
is one file you can download, mail, or open offline.

    python3 build.py            # build every source
    python3 build.py 01-editorial-single.html
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
SHARED = ROOT / "shared"
OUT = ROOT / "catalogs"

LINK = re.compile(r'[ \t]*<link[^>]+href="(?:\.\./)*shared/([^"]+)"[^>]*>[ \t]*\n?')
SCRIPT = re.compile(r'[ \t]*<script[^>]+src="(?:\.\./)*shared/([^"]+)"[^>]*>\s*</script>[ \t]*\n?')


def read_asset(name: str) -> str:
    path = SHARED / name
    if not path.exists():
        raise SystemExit(f"missing shared asset: {path}")
    return path.read_text(encoding="utf-8")


def guard(text: str, closing: str) -> str:
    """A literal '</style>' or '</script>' inside inlined text would end the
    element early. Neither asset contains one today; break any that appears
    later rather than shipping a page that silently truncates."""
    return text.replace(closing, closing[0] + "\\" + closing[1:])


def build(path: Path) -> Path:
    doc = path.read_text(encoding="utf-8")

    def css(match: re.Match) -> str:
        body = guard(read_asset(match.group(1)), "</style>")
        return f"<style>\n/* inlined from shared/{match.group(1)} */\n{body}\n</style>\n"

    def js(match: re.Match) -> str:
        body = guard(read_asset(match.group(1)), "</script>")
        return f"<script>\n/* inlined from shared/{match.group(1)} */\n{body}\n</script>\n"

    doc = LINK.sub(css, doc)
    doc = SCRIPT.sub(js, doc)

    if 'shared/' in doc:
        leftover = re.findall(r'["\'][^"\']*shared/[^"\']+["\']', doc)
        raise SystemExit(f"{path.name}: unresolved shared reference(s): {leftover}")

    OUT.mkdir(exist_ok=True)
    target = OUT / path.name
    target.write_text(doc, encoding="utf-8")
    return target


def main() -> None:
    names = sys.argv[1:]
    sources = [SRC / n for n in names] if names else sorted(SRC.glob("*.html"))
    if not sources:
        raise SystemExit("no sources in src/")
    for src in sources:
        if not src.exists():
            raise SystemExit(f"no such source: {src}")
        target = build(src)
        print(f"{src.name:34} -> {target.relative_to(ROOT)}  ({target.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
