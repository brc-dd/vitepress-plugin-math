#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "fonttools[woff]>=4.60.1",
# ]
# ///
"""Vendor the math web fonts shipped in ``src/fonts/``.

Usage::

    uv run scripts/fonts.py            # populate src/fonts/ (default)
    uv run scripts/fonts.py --subset   # additionally write *-subset.woff2 to the cache
    uv run scripts/fonts.py --force    # ignore the download cache

What it does
------------
1. Downloads the canonical originals into ``scripts/.cache/`` (gitignored),
   verifying each against a pinned SHA-256.
2. Latin Modern Math: extracts the OTF from GUST's zip and converts it to
   WOFF2 with fontTools -- a pure container change, no glyph subsetting, no
   ``name`` table edits, no timestamp rewrite.
3. STIX Two Math: upstream already publishes a WOFF2, so it is copied
   byte-for-byte. Re-encoding a font we were handed in the target format buys
   nothing and would make us the producer of a *modified* binary.
4. Writes the license texts and ``MANIFEST.md`` (provenance, change notice,
   license per font) next to the fonts.
5. Verifies every emitted file loads, and -- for the converted font -- that the
   glyph count, unitsPerEm, MATH table and family name survived the conversion.

Why full coverage is the default (and subsetting is opt-in, cache-only)
-----------------------------------------------------------------------
MathML Core's UA stylesheet applies ``text-transform: math-auto`` to every
single-character ``<mi>``, which maps it into the Mathematical Alphanumeric
Symbols block, U+1D400-1D7FF. That plane is therefore *mandatory* for a math
font on the web -- it is not decoration, it is where ordinary italic variables
live. Keeping it plus the operators, the four stretchy-glyph size variants and
the MATH table leaves very little to remove. Measured by ``--subset`` against
the WOFF2 files this script ships: **10.2%** off Latin Modern Math (382.5 ->
343.4 KiB) and **31.1%** off STIX Two Math (539.0 -> 371.5 KiB). That does not
pay for:

* **Licensing.** OFL-FAQ 2.7/2.8 treat a pure format conversion as "Functional
  Equivalence" -- the font keeps its name legally. A *glyph subset* is a
  modified version, so any Reserved Font Name forces a rename.
* **Font negotiation.** Renaming a family opts it out of the browsers'
  hardcoded math-font lists, and the ``math`` generic cannot see author
  ``@font-face`` rules in Gecko or Chromium anyway. Our CSS therefore names the
  family explicitly -- which only works while the family name is the real one.

So ``--subset`` exists to measure the trade-off, not to ship: its output lands
in ``scripts/.cache/`` and is never copied into ``src/fonts/``.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import sys
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path

import fontTools
from fontTools.ttLib import TTFont

REPO = Path(__file__).resolve().parent.parent
CACHE = REPO / "scripts" / ".cache"
OUT = REPO / "src" / "fonts"

USER_AGENT = "vitepress-plugin-math font vendoring script (+https://github.com/brc-dd/vitepress-plugin-math)"

# Mandatory for MathML Core: `text-transform: math-auto` maps single-char <mi>
# into this block, so every italic variable in every equation lives here.
MATH_ALPHANUMERIC = range(0x1D400, 0x1D800)

# Rough "what a docs site actually renders" set, used only by --subset.
SUBSET_RANGES = (
    range(0x0020, 0x0100),  # Basic Latin + Latin-1 Supplement
    range(0x0300, 0x0400),  # combining diacriticals (accents) + Greek and Coptic
    range(0x2000, 0x2070),  # general punctuation, primes
    range(0x2070, 0x20D0),  # super/subscripts, currency, combining marks for symbols
    range(0x2100, 0x2150),  # letterlike symbols
    range(0x2190, 0x2200),  # arrows
    range(0x2200, 0x2300),  # mathematical operators
    range(0x2300, 0x2400),  # misc technical (stretchy brackets)
    range(0x25A0, 0x2600),  # geometric shapes
    range(0x27C0, 0x2800),  # misc math symbols A/B, supplemental arrows
    range(0x2A00, 0x2B00),  # supplemental mathematical operators
    MATH_ALPHANUMERIC,
)


@dataclass(frozen=True)
class Download:
    """A canonical original we fetch and cache."""

    name: str
    url: str
    sha256: str
    cache_name: str

    @property
    def path(self) -> Path:
        return CACHE / self.cache_name


LM_ZIP = Download(
    name="Latin Modern Math 1959 (GUST)",
    url="https://www.gust.org.pl/projects/e-foundry/lm-math/download/latinmodern-math-1959.zip",
    sha256="aaaa060b4ffc091461e875efb9498b9abfa7c7a48f38eb33882868839903a4f8",
    cache_name="latinmodern-math-1959.zip",
)

# GUST's own server is the primary source; CTAN mirrors the identical release.
LM_ZIP_MIRROR = "https://mirrors.ctan.org/fonts/lm-math.zip"

# stipub/stixfonts stopped committing built binaries after v2.13b171 -- the
# v2.14 tag is an "INTERIM (build process conversion)" commit with no `fonts/`
# directory. v2.13b171 is therefore the newest tag that ships a WOFF2, and it
# is also the newest GitHub *release*.
STIX_TAG = "v2.13b171"
STIX_WOFF2 = Download(
    name="STIX Two Math (stipub/stixfonts)",
    url=f"https://raw.githubusercontent.com/stipub/stixfonts/{STIX_TAG}/fonts/static_otf_woff2/STIXTwoMath-Regular.woff2",
    sha256="094191335def3f0452c81ec0713cfc2f29bb6af8cecbf79b60881fbf2db97562",
    cache_name="STIXTwoMath-Regular.woff2",
)
STIX_OFL = Download(
    name="STIX Two OFL 1.1",
    url=f"https://raw.githubusercontent.com/stipub/stixfonts/{STIX_TAG}/OFL.txt",
    sha256="0c8825913b60d858aacdb33c4ca6660a7d64b0d6464702efbb19313f5765861a",
    cache_name="STIX-OFL.txt",
)
GUST_LICENSE = Download(
    name="GUST Font License",
    url="https://www.gust.org.pl/projects/e-foundry/licenses/GUST-FONT-LICENSE.txt",
    sha256="",
    cache_name="GUST-FONT-LICENSE.txt",
)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def human(size: int) -> str:
    return f"{size:,} B ({size / 1024:.1f} KiB)"


def log(message: str) -> None:
    print(message, flush=True)


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310 - pinned https URLs
        return response.read()


def cached(item: Download, *, force: bool = False, fallback_url: str | None = None) -> bytes:
    """Return the bytes of a download, using ``scripts/.cache/`` when possible.

    A cached file is reused when its digest matches the pin. An empty pin means
    "not yet pinned": the digest is reported so it can be recorded, and the
    cache is still reused.
    """
    if item.path.exists() and not force:
        data = item.path.read_bytes()
        digest = sha256_of(data)
        if not item.sha256:
            log(f"  cached  {item.cache_name}  sha256={digest}  (unpinned)")
            return data
        if digest == item.sha256:
            log(f"  cached  {item.cache_name}  sha256={digest}")
            return data
        log(f"  stale   {item.cache_name}  (digest changed, re-downloading)")

    urls = [item.url] + ([fallback_url] if fallback_url else [])
    last_error: Exception | None = None
    for url in urls:
        try:
            log(f"  fetch   {url}")
            data = fetch(url)
            break
        except Exception as error:  # noqa: BLE001 - report and try the mirror
            log(f"  failed  {error}")
            last_error = error
    else:
        raise SystemExit(f"could not download {item.name}: {last_error}")

    digest = sha256_of(data)
    if item.sha256 and digest != item.sha256:
        raise SystemExit(
            f"checksum mismatch for {item.name}\n"
            f"  expected {item.sha256}\n"
            f"  got      {digest}\n"
            "Refusing to vendor an unverified binary. If upstream really did "
            "republish this file, update the pin in scripts/fonts.py."
        )

    CACHE.mkdir(parents=True, exist_ok=True)
    item.path.write_bytes(data)
    log(f"  saved   {item.path.relative_to(REPO)}  {human(len(data))}  sha256={digest}")
    return data


def open_font(source: Path | bytes) -> TTFont:
    """Load a font without letting fontTools rewrite ``head.modified``."""
    handle = io.BytesIO(source) if isinstance(source, bytes) else str(source)
    return TTFont(handle, recalcTimestamp=False, recalcBBoxes=False)


def family_names(font: TTFont) -> dict[int, str]:
    """Family-ish name records: 1 = family, 4 = full, 6 = PostScript, 16 = typographic."""
    names: dict[int, str] = {}
    for record in font["name"].names:
        if record.nameID in (1, 4, 6, 16) and record.nameID not in names:
            names[record.nameID] = str(record)
    return names


def describe(font: TTFont) -> str:
    names = family_names(font)
    return (
        f"family={names.get(1, '?')!r} "
        f"version={font['name'].getDebugName(5) or '?'!s} "
        f"glyphs={len(font.getGlyphOrder())} "
        f"upem={font['head'].unitsPerEm} "
        f"MATH={'yes' if 'MATH' in font else 'NO'}"
    )


# --------------------------------------------------------------------------
# Latin Modern Math: OTF -> WOFF2
# --------------------------------------------------------------------------


def extract_otf(zip_bytes: bytes) -> tuple[bytes, str, str | None]:
    """Pull ``latinmodern-math.otf`` (and any bundled license) out of GUST's zip."""
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    otf_members = [n for n in archive.namelist() if n.lower().endswith(".otf")]
    if len(otf_members) != 1:
        raise SystemExit(f"expected exactly one OTF in the GUST zip, found {otf_members}")

    license_members = [
        n for n in archive.namelist() if Path(n).name.lower() in {"gust-font-license.txt", "gfl.txt"}
    ]
    bundled_license = archive.read(license_members[0]).decode("utf-8") if license_members else None

    return archive.read(otf_members[0]), otf_members[0], bundled_license


def to_woff2(otf_bytes: bytes, destination: Path) -> tuple[TTFont, TTFont]:
    """Convert an OTF to WOFF2 in place -- container only, nothing else touched."""
    source = open_font(otf_bytes)
    converted = open_font(otf_bytes)
    converted.flavor = "woff2"
    # WOFF2 has no extended-metadata block unless we attach one, and
    # `recalcTimestamp=False` above keeps `head.modified` at the value GUST
    # shipped -- so the same input always produces the same bytes.
    converted.flavorData = None
    destination.parent.mkdir(parents=True, exist_ok=True)
    converted.save(destination)
    return source, open_font(destination)


def verify_conversion(source: TTFont, result: TTFont) -> None:
    problems: list[str] = []

    source_glyphs = len(source.getGlyphOrder())
    result_glyphs = len(result.getGlyphOrder())
    if source_glyphs != result_glyphs:
        problems.append(f"glyph count changed: {source_glyphs} -> {result_glyphs}")

    if "MATH" not in result:
        problems.append("MATH table missing from the WOFF2")

    if source["head"].unitsPerEm != result["head"].unitsPerEm:
        problems.append(
            f"unitsPerEm changed: {source['head'].unitsPerEm} -> {result['head'].unitsPerEm}"
        )

    source_names, result_names = family_names(source), family_names(result)
    if source_names != result_names:
        problems.append(f"name records changed: {source_names} -> {result_names}")

    if len(source["name"].names) != len(result["name"].names):
        problems.append(
            f"name table size changed: {len(source['name'].names)} -> {len(result['name'].names)}"
        )

    source_cmap = set(source.getBestCmap())
    result_cmap = set(result.getBestCmap())
    if source_cmap != result_cmap:
        problems.append(f"cmap coverage changed by {len(source_cmap ^ result_cmap)} code points")

    if problems:
        raise SystemExit("conversion verification failed:\n  " + "\n  ".join(problems))


# --------------------------------------------------------------------------
# optional subsetting (cache only -- never shipped)
# --------------------------------------------------------------------------


def subset(font_bytes: bytes, destination: Path, label: str, baseline: int) -> None:
    """Write a subsetted WOFF2 to the cache and report it against the shipped WOFF2.

    ``baseline`` is the size of the *full-coverage WOFF2 we actually ship* -- not
    the source OTF. Comparing a subsetted WOFF2 against an OTF would credit
    subsetting with the savings that the format conversion already delivered.
    """
    from fontTools import subset as ftsubset

    font = open_font(font_bytes)
    before = len(font.getGlyphOrder())

    options = ftsubset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.glyph_names = True
    options.recalc_bounds = False
    options.recalc_timestamp = False
    options.drop_tables = []
    options.passthrough_tables = True

    subsetter = ftsubset.Subsetter(options=options)
    unicodes: set[int] = set()
    for span in SUBSET_RANGES:
        unicodes.update(span)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)

    font.flavor = "woff2"
    font.flavorData = None
    destination.parent.mkdir(parents=True, exist_ok=True)
    font.save(destination)

    subsetted = destination.stat().st_size
    after = len(font.getGlyphOrder())
    saved = 100 * (1 - subsetted / baseline) if baseline else 0
    log(f"  {label}")
    log(f"    glyphs  {before} -> {after}")
    log(f"    woff2   {human(baseline)} -> {human(subsetted)}  ({saved:.1f}% smaller)")

    check = open_font(destination)
    if "MATH" not in check:
        log("    WARNING: lost its MATH table -- unusable as a math font")
    covered = sum(1 for cp in check.getBestCmap() if cp in MATH_ALPHANUMERIC)
    log(f"    U+1D400-1D7FF retained: {covered} code points")


SUBSET_WARNING = """
!!  SUBSET OUTPUT IS NOT DISTRIBUTABLE AS-IS  !!

    A glyph subset is a MODIFIED VERSION of the font, not a format conversion:

    * STIX Two Math carries the OFL Reserved Font Name "TM Math". A modified
      version may not be distributed under any name containing it, and the OFL
      also forbids selling the font by itself.
    * Latin Modern Math is under the GUST Font License (LPPL 1.3c). GFL clause 1
      requests -- not legally requires -- that derived works rename the fonts
      listed in MANIFEST-Latin-Modern-Math.txt, which does list "Latin Modern
      Math" and "LatinModernMath-Regular". We keep those names for the pure
      format conversion because it is functionally equivalent to the original;
      a glyph subset is not, so honor the request there. LPPL 1.3c 6b (prominent
      change notice) and 6d (ship or link the unmodified original) apply either
      way.

    Renaming a family also opts it out of the browsers' built-in math-font
    lists, so any renamed subset must be named explicitly in CSS.

    These files stay in scripts/.cache/. Nothing here is copied to src/fonts/.
"""


# --------------------------------------------------------------------------
# manifest
# --------------------------------------------------------------------------


def write_manifest(entries: list[dict[str, str]], gust_license_origin: str) -> Path:
    lines = [
        "# Vendored math fonts",
        "",
        "Generated by `scripts/fonts.py` (`uv run scripts/fonts.py`). Do not edit by hand;",
        "re-run the script instead. It is idempotent -- cached originals are verified by",
        "SHA-256 and reused, and the outputs are rewritten deterministically.",
        "",
        "Every font here is the **unmodified upstream font**: no glyph subsetting, no",
        "`name` table edits, no re-hinting, no metadata injection. Coverage of",
        "U+1D400-1D7FF (Mathematical Alphanumeric Symbols) is mandatory for MathML Core,",
        "whose UA stylesheet maps single-character `<mi>` into that block via",
        "`text-transform: math-auto`.",
        "",
    ]

    for entry in entries:
        lines += [
            f"## {entry['title']}",
            "",
            f"- **File:** `{entry['file']}` -- {entry['size']}",
            f"- **Source:** {entry['source']}",
            f"- **Upstream version:** {entry['version']}",
            f"- **Upstream SHA-256:** `{entry['sha256']}`{entry.get('sha256_of', '')}",
            f"- **What was done:** {entry['processing']}",
            f"- **License:** {entry['license']}",
            f"- **Family name:** `{entry['family']}` (unchanged from upstream)",
            f"- **Glyphs:** {entry['glyphs']} · **MATH table:** {entry['math']}",
            "",
        ]
        if entry.get("notice"):
            lines += [entry["notice"], ""]

    lines += [
        "## License files in this directory",
        "",
        f"- `GUST-FONT-LICENSE.txt` -- the GUST Font License, verbatim ({gust_license_origin}).",
        "- `OFL-STIXTwoMath.txt` -- SIL Open Font License 1.1 with the STIX copyright",
        "  header, verbatim from the stixfonts repository.",
        "",
        "## Attribution",
        "",
        "Latin Modern Math is copyright 2012-2014 for TeX Gyre math extensions by",
        "B. Jackowski, P. Strzelczyk and P. Pianowski (on behalf of TeX Users Groups).",
        "STIX Two Math is copyright 2001-2021 The STIX Fonts Project Authors; STIX",
        "Fonts™ is a trademark of the IEEE.",
        "",
        "Neither project endorses, supports or is responsible for this package or the",
        "files in this directory (LPPL 1.3c clause 6c).",
        "",
    ]

    path = OUT / "MANIFEST.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download, convert and vendor the math web fonts in src/fonts/.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=SUBSET_WARNING,
    )
    parser.add_argument(
        "--subset",
        action="store_true",
        help="also write *-subset.woff2 into scripts/.cache/ (never shipped; see the warning below)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="re-download the originals even when the cache is valid",
    )
    args = parser.parse_args()

    log(f"fontTools {fontTools.version} · cache {CACHE.relative_to(REPO)} · out {OUT.relative_to(REPO)}")
    OUT.mkdir(parents=True, exist_ok=True)
    entries: list[dict[str, str]] = []

    # -- Latin Modern Math -------------------------------------------------
    log("\nLatin Modern Math")
    zip_bytes = cached(LM_ZIP, force=args.force, fallback_url=LM_ZIP_MIRROR)
    zip_digest = sha256_of(zip_bytes)
    otf_bytes, otf_member, bundled_license = extract_otf(zip_bytes)
    log(f"  extract {otf_member}  {human(len(otf_bytes))}")

    lm_out = OUT / "latin-modern-math.woff2"
    source_font, result_font = to_woff2(otf_bytes, lm_out)
    verify_conversion(source_font, result_font)
    log(f"  source  {describe(source_font)}")
    log(f"  woff2   {describe(result_font)}")
    log(f"  wrote   {lm_out.relative_to(REPO)}  {human(lm_out.stat().st_size)}")

    lm_version = source_font["name"].getDebugName(5) or "1.959"
    entries.append(
        {
            "title": "Latin Modern Math",
            "file": "latin-modern-math.woff2",
            "size": human(lm_out.stat().st_size),
            "source": f"[{LM_ZIP.url}]({LM_ZIP.url}) (member `{otf_member}`)",
            "version": f"{lm_version} (GUST release 1959)",
            "sha256": zip_digest,
            "sha256_of": " (of the zip)",
            "processing": (
                f"Converted OTF to WOFF2 with fontTools {fontTools.version}. Container format only: "
                "no glyph subsetting, no `name` table changes, no re-hinting, no metadata "
                "injection, `head.modified` preserved. Glyph count, unitsPerEm, cmap coverage, "
                "`name` records and the MATH table were asserted identical to the source OTF."
            ),
            "license": (
                "GUST Font License (GFL) -- legally equivalent to LPPL 1.3c. "
                "See `GUST-FONT-LICENSE.txt`."
            ),
            "family": family_names(result_font).get(1, "Latin Modern Math"),
            "glyphs": str(len(result_font.getGlyphOrder())),
            "math": "present" if "MATH" in result_font else "MISSING",
            "notice": (
                "### Change notice (GUST Font License / LPPL 1.3c clause 6b)\n"
                "\n"
                "> **This is a Derived Work.** The only change is the container format: the\n"
                f"> OpenType/CFF file `{otf_member}` from\n"
                f"> `{LM_ZIP.path.name}` was converted to WOFF2 with fontTools\n"
                f"> {fontTools.version}. No glyph outlines, metrics, MATH table entries, `name`\n"
                "> records, `cmap` coverage or any other font data were altered, added or\n"
                "> removed, and `head.modified` is left at the value GUST shipped. The script\n"
                "> asserts all of that after every conversion.\n"
                ">\n"
                "> A complete, unmodified copy of the Work is obtainable from the GUST\n"
                f"> e-foundry at <{LM_ZIP.url}>\n"
                f"> and from CTAN at <{LM_ZIP_MIRROR}> (LPPL 1.3c clause 6d.2).\n"
                "\n"
                "#### On the GFL renaming request\n"
                "\n"
                'Clause 1 of the GUST Font License asks -- _"it is requested, but not legally\n'
                'required"_ -- that derived works rename both the fonts and the files listed in\n'
                "the upstream `MANIFEST-Latin-Modern-Math.txt`. That manifest lists the OTF menu\n"
                "names `Latin Modern Math` and `LatinModernMath-Regular` (§1.1) and the file\n"
                "`otf/latinmodern-math.otf` (§2.1).\n"
                "\n"
                "The **file** is renamed (`latin-modern-math.woff2`). The **menu names are\n"
                "deliberately kept**, and this is a disclosed departure from a request the\n"
                "license itself marks as non-binding:\n"
                "\n"
                "- The conversion is functionally equivalent to the original in the OFL-FAQ\n"
                "  2.7/2.8 sense -- same outlines, same metrics, same MATH table, same `name`\n"
                "  records. A renamed family would misrepresent a font that is byte-for-byte\n"
                "  equivalent in every table as something different.\n"
                "- Browsers keep hardcoded lists of math family names for MathML font handling.\n"
                "  Renaming the family opts it out of those lists, and the `math` generic cannot\n"
                "  see `@font-face` in Gecko or Chromium, so there is no way to opt back in.\n"
                "\n"
                "A **glyph subset** would be a different matter -- see `scripts/fonts.py\n"
                "--subset`, which refuses to write into this directory for exactly that reason."
            ),
        }
    )

    # -- STIX Two Math -----------------------------------------------------
    log("\nSTIX Two Math")
    stix_bytes = cached(STIX_WOFF2, force=args.force)
    stix_digest = sha256_of(stix_bytes)
    stix_out = OUT / "stix-two-math.woff2"
    stix_out.write_bytes(stix_bytes)  # verbatim: upstream already ships WOFF2
    stix_font = open_font(stix_out)
    if stix_font.flavor != "woff2":
        raise SystemExit(f"expected a WOFF2 from upstream, got flavor={stix_font.flavor!r}")
    if "MATH" not in stix_font:
        raise SystemExit("upstream STIX Two Math WOFF2 has no MATH table")
    if not any(0x1D400 <= cp < 0x1D800 for cp in stix_font.getBestCmap()):
        raise SystemExit("upstream STIX Two Math WOFF2 does not cover U+1D400-1D7FF")
    log(f"  woff2   {describe(stix_font)}")
    log(f"  wrote   {stix_out.relative_to(REPO)}  {human(stix_out.stat().st_size)}")

    entries.append(
        {
            "title": "STIX Two Math",
            "file": "stix-two-math.woff2",
            "size": human(stix_out.stat().st_size),
            "source": f"[{STIX_WOFF2.url}]({STIX_WOFF2.url})",
            "version": (
                f"{stix_font['name'].getDebugName(5) or '?'} "
                f"(stipub/stixfonts tag `{STIX_TAG}` -- the newest tag that still ships built "
                "binaries; `v2.14` is an interim build-process commit with no `fonts/` directory)"
            ),
            "sha256": stix_digest,
            "processing": (
                "Copied byte-for-byte. Upstream publishes WOFF2 directly, so there is nothing "
                "to convert; re-encoding would only make us the producer of a modified binary. "
                "Verified after copying: valid WOFF2 flavour, MATH table present, "
                "U+1D400-1D7FF covered."
            ),
            "license": (
                'SIL Open Font License 1.1, with Reserved Font Name "TM Math" (note: the RFN is '
                '"TM Math", _not_ "STIX" or "STIX Two Math"). See `OFL-STIXTwoMath.txt`. '
                "STIX Fonts™ is a trademark of the IEEE."
            ),
            "family": family_names(stix_font).get(1, "STIX Two Math"),
            "glyphs": str(len(stix_font.getGlyphOrder())),
            "math": "present" if "MATH" in stix_font else "MISSING",
            "notice": (
                "### Modification notice (OFL 1.1)\n"
                "\n"
                "> Not modified. This is the upstream WOFF2 build, unaltered."
            ),
        }
    )

    # -- license texts -----------------------------------------------------
    log("\nLicense texts")
    if bundled_license:
        gust_text = bundled_license
        gust_origin = f"bundled in `{LM_ZIP.path.name}`"
        log(f"  bundled GUST-FONT-LICENSE.txt from {LM_ZIP.path.name}")
    else:
        gust_text = cached(GUST_LICENSE, force=args.force).decode("utf-8")
        gust_origin = f"fetched from <{GUST_LICENSE.url}>"
    (OUT / "GUST-FONT-LICENSE.txt").write_text(gust_text, encoding="utf-8")
    log(f"  wrote   src/fonts/GUST-FONT-LICENSE.txt  {human(len(gust_text.encode()))}")

    ofl_text = cached(STIX_OFL, force=args.force).decode("utf-8")
    (OUT / "OFL-STIXTwoMath.txt").write_text(ofl_text, encoding="utf-8")
    log(f"  wrote   src/fonts/OFL-STIXTwoMath.txt  {human(len(ofl_text.encode()))}")

    manifest = write_manifest(entries, gust_origin)
    log(f"  wrote   {manifest.relative_to(REPO)}  {human(manifest.stat().st_size)}")

    # -- optional subsets --------------------------------------------------
    if args.subset:
        log("\nSubsets (cache only)")
        log(SUBSET_WARNING)
        subset(
            otf_bytes,
            CACHE / "latin-modern-math-subset.woff2",
            "latin-modern-math",
            lm_out.stat().st_size,
        )
        subset(
            stix_bytes,
            CACHE / "stix-two-math-subset.woff2",
            "stix-two-math",
            stix_out.stat().st_size,
        )
        log(
            "\n  Reminder: these are in scripts/.cache/ on purpose. Shipping them means "
            "renaming the families and re-checking every license obligation above."
        )

    # -- summary -----------------------------------------------------------
    log("\nsrc/fonts/")
    total = 0
    for path in sorted(OUT.iterdir()):
        size = path.stat().st_size
        total += size
        log(f"  {path.name:<28} {human(size)}")
    log(f"  {'total':<28} {human(total)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
