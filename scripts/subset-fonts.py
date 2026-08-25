#!/usr/bin/env python3
"""
MGC-743 — Subset + WOFF2 conversion for Inter & Poppins (8 weights).

Reads TTFs from node_modules/@expo-google-fonts/{inter,poppins}/<weight>/,
subset to latin (Latin + Latin Ext + Punctuation + General Punctuation),
re-encode as WOFF2 into assets/fonts/woff2/.

Output structure:
  assets/fonts/woff2/Inter-{Regular,Medium,SemiBold,Bold}.woff2
  assets/fonts/woff2/Poppins-{Regular,Medium,SemiBold,Bold}.woff2

The match between Family-Weight slug and @expo-google-fonts/<font>/<weight>/
is documented in app/_layout.tsx (MGC-555 PR1). If that mapping changes,
keep this list in sync.
"""
from __future__ import annotations
import subprocess
import sys
from pathlib import Path

# Pillow-free path: invoke pyftsubset binary directly (installed by
# `pip install fonttools brotli`). Output on macOS user-bin location.
PYFTSUBSET = Path.home() / "Library/Python/3.9/bin/pyftsubset"

# Subset coverage: same as Google's "latin" subset.
LATIN_RANGES = [
    (0x0020, 0x007F),    # Basic Latin
    (0x00A0, 0x00FF),    # Latin-1 Supplement
    (0x0100, 0x017F),    # Latin Extended-A
    (0x2000, 0x206F),    # General Punctuation
    (0x20A0, 0x20CF),    # Currency Symbols
    (0x2122, 0x2122),    # ™
    (0x2190, 0x2193),    # ← ↑ → ↓
    (0x25A0, 0x25FE),    # ■ ▢ ▲ ▼
]

UNICODE_RANGES_ARG = ",".join(
    f"U+{lo:04X}-{hi:04X}" for (lo, hi) in LATIN_RANGES
)

# (family_slug, expo_google_fonts_dir, weight_dir_name, output_file)
WEIGHTS = [
    ("Regular",  "inter",   "400Regular",  "Inter-Regular.woff2"),
    ("Medium",   "inter",   "500Medium",   "Inter-Medium.woff2"),
    ("SemiBold", "inter",   "600SemiBold", "Inter-SemiBold.woff2"),
    ("Bold",     "inter",   "700Bold",     "Inter-Bold.woff2"),
    ("Regular",  "poppins", "400Regular",  "Poppins-Regular.woff2"),
    ("Medium",   "poppins", "500Medium",   "Poppins-Medium.woff2"),
    ("SemiBold", "poppins", "600SemiBold", "Poppins-SemiBold.woff2"),
    ("Bold",     "poppins", "700Bold",     "Poppins-Bold.woff2"),
]


def find_ttf(package_root: Path, family_dir: str, weight_dir: str) -> Path:
    weight_path = package_root / "@expo-google-fonts" / family_dir / weight_dir
    if not weight_path.is_dir():
        raise FileNotFoundError(f"missing expo-google-fonts weight dir: {weight_path}")
    candidates = sorted(weight_path.glob("*.ttf"))
    if not candidates:
        raise FileNotFoundError(f"no TTF in: {weight_path}")
    return candidates[0]


def subset_one(ttf: Path, out: Path) -> tuple[int, int]:
    cmd = [
        str(PYFTSUBSET),
        str(ttf),
        f"--output-file={out}",
        "--flavor=woff2",
        f"--unicodes={UNICODE_RANGES_ARG}",
        "--no-hinting",
        "--desubroutinize",
        "--ignore-missing-glyphs",
        "--ignore-missing-unicodes",
        "--layout-features=*",
        "--notdef-outline",
        "--name-IDs=*",
        "--name-legacy",
        "--name-languages=*",
    ]
    if not out.parent.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.stderr.write(f"pyftsubset failed for {ttf.name}:\n{res.stderr}\n")
        raise SystemExit(res.returncode)
    return ttf.stat().st_size, out.stat().st_size


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    out_dir = repo_root / "assets" / "fonts" / "woff2"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"out dir: {out_dir}")
    print(f"{'file':<32} {'ttf(B)':>10} {'woff2(B)':>10} {'ratio':>7}")
    print("-" * 64)

    total_before = 0
    total_after = 0
    for weight_name, family_dir, weight_dir, fname in WEIGHTS:
        ttf = find_ttf(repo_root / "node_modules", family_dir, weight_dir)
        out = out_dir / fname
        before, after = subset_one(ttf, out)
        total_before += before
        total_after += after
        ratio = after / before * 100 if before else 0
        print(f"{fname:<32} {before:>10} {after:>10} {ratio:>6.1f}%")

    print("-" * 64)
    print(f"{'TOTAL':<32} {total_before:>10} {total_after:>10} "
          f"{total_after / total_before * 100 if total_before else 0:>6.1f}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
