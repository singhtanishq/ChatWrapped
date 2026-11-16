#!/usr/bin/env python3
"""
validate-readme-screenshots.py — README screenshot validation (Part 22.1).

Recursively enumerates approved screenshots under docs/screenshots/, extracts
image references from the root README.md, and verifies:
  - every referenced image exists (no broken references)
  - every approved screenshot is embedded in the README (none unreferenced)
  - no malformed (non-relative) paths or duplicate references
  - the screenshot manifest (SCREENSHOT_INDEX.md) cross-checks

Exit code 1 if any check fails.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"
SCREENSHOT_DIR = ROOT / "docs" / "screenshots"
MANIFEST = SCREENSHOT_DIR / "SCREENSHOT_INDEX.md"

APPROVED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
IMAGE_REF_RE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)[^)]*\)")


def find_approved() -> set[str]:
    """All screenshot files (relative paths, posix style) under docs/screenshots."""
    approved: set[str] = set()
    if not SCREENSHOT_DIR.exists():
        return approved
    for path in SCREENSHOT_DIR.rglob("*"):
        if path.is_file() and path.suffix.lower() in APPROVED_EXTENSIONS and path.name != "SCREENSHOT_INDEX.md":
            approved.add(path.relative_to(ROOT).as_posix())
    return approved


def extract_references(readme_text: str) -> list[str]:
    return IMAGE_REF_RE.findall(readme_text)


def is_valid_relative_path(ref: str) -> bool:
    if ref.startswith(("http://", "https://", "/")):
        return False
    if ".." in ref or ref.startswith("./"):
        return False
    return ref.endswith(tuple(APPROVED_EXTENSIONS))


def cross_check_manifest(referenced: set[str]) -> list[str]:
    """Return warnings where the manifest disagrees with the README state."""
    problems: list[str] = []
    if not MANIFEST.exists():
        problems.append("docs/screenshots/SCREENSHOT_INDEX.md is missing")
        return problems
    manifest_text = MANIFEST.read_text(encoding="utf-8")
    manifest_paths = set(re.findall(r"docs/screenshots/[A-Za-z0-9\-./_]+\.(?:png|jpg|jpeg|webp)", manifest_text))
    for p in sorted(referenced - manifest_paths):
        problems.append(f"manifest does not list embedded screenshot: {p}")
    for p in sorted(manifest_paths - referenced):
        problems.append(f"manifest lists a screenshot not embedded in README: {p}")
    return problems


def main() -> int:
    if not README.exists():
        print("ERROR: README.md not found")
        return 1

    readme_text = README.read_text(encoding="utf-8")
    approved = find_approved()
    refs = extract_references(readme_text)

    referenced: set[str] = set()
    broken: list[str] = []
    malformed: list[str] = []
    duplicates: list[str] = []

    seen: dict[str, int] = {}
    for ref in refs:
        if not is_valid_relative_path(ref):
            malformed.append(ref)
            continue
        seen[ref] = seen.get(ref, 0) + 1
        if seen[ref] == 2:
            duplicates.append(ref)
        if not (ROOT / ref).exists():
            broken.append(ref)
        referenced.add(ref)

    unreferenced = sorted(p for p in approved if p not in referenced)

    print("README screenshot validation")
    print(f"  Approved screenshots: {len(approved)}")
    print(f"  Embedded in README:   {len(referenced)}")
    print(f"  Unreferenced screenshots: {len(unreferenced)}")
    print(f"  Broken references:        {len(broken)}")
    print(f"  Malformed paths:          {len(malformed)}")
    print(f"  Duplicate references:     {len(duplicates)}")

    exit_code = 0
    for p in unreferenced:
        print(f"  ✗ unreferenced screenshot: {p}")
        exit_code = 1
    for p in broken:
        print(f"  ✗ broken reference: {p}")
        exit_code = 1
    for p in malformed:
        print(f"  ✗ malformed path (must be relative, no ../): {p}")
        exit_code = 1
    for p in duplicates:
        print(f"  ✗ duplicate reference: {p}")
        exit_code = 1

    manifest_problems = cross_check_manifest(referenced)
    if manifest_problems:
        exit_code = 1
        for p in manifest_problems:
            print(f"  ✗ {p}")
    print(f"  Manifest mismatches:      {len(manifest_problems)}")

    if exit_code == 0:
        print("  ✓ README screenshot validation passed")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
