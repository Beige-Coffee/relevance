#!/usr/bin/env python3
"""
Sweep em dashes from public-facing files. Replaces them with appropriate
punctuation (comma, period, or restructured) based on surrounding context.

Excludes data/transcripts/ since those are verbatim Vervaeke quotes that
must not be modified, and excludes backup/log files that are not surfaced.

Strategy:
  ' — '  ->  ', '       (most common: parenthetical pause)
  '— '   ->  ', '       (start of clause)
  ' —'   ->  ','        (end of clause)
  '—'    ->  ','        (no spaces, catch-all)

Then clean up artifacts:
  ',,'   ->  ','
  ', .'  ->  '.'
  ',.'   ->  '.'
  ', ,'  ->  ','
"""
import os, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

INCLUDE_GLOBS = [
    "src/**/*.ts", "src/**/*.tsx", "src/**/*.css", "src/**/*.json",
    "data/registry/concepts.json",
    "data/registry/people.json",
    "data/registry/_enrichment_*.json",
    "data/courses/*.json",
    "data/metadata/*.json",
    "README.md",
    "CLAUDE.md",
    "AGENTS.md",
]
EXCLUDE_PATHS = [
    "data/transcripts",          # do not touch Vervaeke transcripts
    "data/registry/concepts.pre-enrichment.json",
    "data/registry/_cleanup-log.json",
    "data/registry/_validation-report.json",
    "data/registry/_validation-report.html",
    "data/registry/_browser.html",
    "data/courses/_reviews",     # regenerated artifacts
    "node_modules",
    ".next",
]

def should_skip(path: Path) -> bool:
    rel = str(path.relative_to(ROOT))
    return any(rel.startswith(e) or e in rel for e in EXCLUDE_PATHS)

def sweep(text: str) -> tuple[str, int]:
    if "—" not in text:
        return text, 0
    original = text
    text = text.replace(" — ", ", ")
    text = text.replace("— ", ", ")
    text = text.replace(" —", ",")
    text = text.replace("—", ",")
    # Cleanup artifacts
    text = re.sub(r",,+", ",", text)
    text = re.sub(r",\s*\.", ".", text)
    text = re.sub(r",\s*,", ",", text)
    text = re.sub(r"\s+,", ",", text)
    # Re-introduce a space after commas where the substitution dropped one
    text = re.sub(r",([A-Za-z])", r", \1", text)
    n = original.count("—")
    return text, n

def main():
    files = set()
    for pattern in INCLUDE_GLOBS:
        files.update(ROOT.glob(pattern))
    files = sorted(f for f in files if f.is_file() and not should_skip(f))

    total = 0
    changed = 0
    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except Exception as e:
            print(f"  skip {f}: {e}")
            continue
        new, n = sweep(text)
        if n > 0:
            f.write_text(new, encoding="utf-8")
            print(f"  {f.relative_to(ROOT)}: {n}")
            changed += 1
            total += n

    print(f"\nReplaced {total} em dashes across {changed} files.")

if __name__ == "__main__":
    main()
