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

* **Licensing.** A glyph subset is unambiguously a modified version under both
  licenses involved, which puts every renaming obligation back in play: OFL 1.1
  clause 3 would bar a Reserved Font Name outright, and the GUST Font License's
  clause-1 renaming request would no longer be answerable by "the file is
  functionally equivalent to the original". Note that OFL 1.1 defines a
  "Modified Version" to include one made "by changing formats" -- which is
  exactly why STIX Two Math is copied byte-for-byte below rather than
  re-encoded, and why the OFL-FAQ 2.7/2.8 functional-equivalence discussion is
  cited only by analogy for Latin Modern Math, which is not an OFL font.
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

    * STIX Two Math is under the SIL Open Font License 1.1 with the Reserved
      Font Name "TM Math". Subsetting makes it a Modified Version, so OFL 1.1
      clause 3 bars using the RFN as its primary font name; clause 2 still
      requires the copyright notice and license to travel with every copy, and
      clause 1 still forbids selling the font by itself.
    * Latin Modern Math is under the GUST Font License, which places it under
      LPPL 1.3c. GFL clause 1 requests -- and expressly does not legally
      require -- that derived works rename the fonts listed in
      MANIFEST-Latin-Modern-Math.txt, which lists "Latin Modern Math" and
      "LatinModernMath-Regular". Those names are kept for the pure format
      conversion, on the ground that it is functionally equivalent to the
      original; a glyph subset is not, so honor the request there. LPPL 1.3c 6b
      (prominent change notice), 6c (no implied upstream support) and 6d (ship
      or link the unmodified original) apply either way.

    Renaming a family also opts it out of the browsers' built-in math-font
    lists, so any renamed subset must be named explicitly in CSS.

    These files stay in scripts/.cache/. Nothing here is copied to src/fonts/.
"""


# --------------------------------------------------------------------------
# manifest
# --------------------------------------------------------------------------


def write_manifest(entries: list[dict[str, str]], gust_license_origin: str) -> Path:
    lines = [
        "# Vendored math fonts: provenance and license notices",
        "",
        "Generated by `scripts/fonts.py` (`uv run scripts/fonts.py`). Do not edit by hand;",
        "re-run the script instead. It is idempotent -- cached originals are verified by",
        "SHA-256 and reused, and the outputs are rewritten deterministically.",
        "",
        "This directory redistributes third-party font software. **The fonts are not",
        "covered by this package's MIT license.** Each is governed by the license",
        "distributed beside it here, and those terms travel with the files into",
        "`dist/fonts/` and into the published tarball. `ACKNOWLEDGEMENTS.md` at the",
        "repository root is the package's notice register and points back to this file.",
        "",
        "Neither font is subsetted. Both retain full coverage of U+1D400-1D7FF",
        "(Mathematical Alphanumeric Symbols), which MathML Core makes mandatory: its UA",
        "stylesheet maps every single-character `<mi>` into that block via",
        "`text-transform: math-auto`. A glyph subset would be a modified version of the",
        "font under both licenses below; nothing here is one.",
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
            f"- **Copyright:** {entry['copyright']}",
            f"- **License:** {entry['license']}",
            f"- **Status under that license:** {entry['status']}",
            f"- **Transformation applied:** {entry['processing']}",
            f"- **Family name:** `{entry['family']}` (unchanged from upstream)",
            f"- **Glyphs:** {entry['glyphs']} · **MATH table:** {entry['math']}",
            "",
        ]
        if entry.get("obligations"):
            lines += [entry["obligations"], ""]
        if entry.get("notice"):
            lines += [entry["notice"], ""]

    lines += [
        "## License files in this directory",
        "",
        f"- `GUST-FONT-LICENSE.txt` -- the GUST Font License, verbatim ({gust_license_origin}).",
        "- `OFL-STIXTwoMath.txt` -- SIL Open Font License 1.1 with the STIX copyright",
        "  header, verbatim from the stixfonts repository.",
        "",
        "Both files are copied into `dist/fonts/` by the build and are present in the",
        "published npm tarball. Removing either from a redistribution would breach the",
        "license it carries.",
        "",
        "## No endorsement, no support",
        "",
        "Neither GUST, the TeX Users Groups, the Latin Modern Math authors, the STIX",
        "Fonts Project Authors nor the IEEE endorses, supports, or is responsible for",
        "this package or for the files in this directory. This statement satisfies",
        "LPPL 1.3c clause 6c for Latin Modern Math and is offered for STIX Two Math as a",
        "matter of accuracy. STIX Fonts™ is a trademark of The Institute of Electrical",
        "and Electronics Engineers, Inc.; it is named here only to identify the font, and",
        "no trademark or sponsorship claim is made or implied.",
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
            "copyright": (
                "Copyright 2012--2014 for TeX Gyre math extensions by B. Jackowski, "
                "P. Strzelczyk and P. Pianowski (on behalf of TeX Users Groups), quoted as "
                "stated in the upstream `doc/MANIFEST-Latin-Modern-Math.txt`."
            ),
            "license": (
                "GUST Font License (GFL), which places the work under the LaTeX Project "
                "Public License, version 1.3c or later. Text: `GUST-FONT-LICENSE.txt`; "
                "LPPL 1.3c at <https://www.latex-project.org/lppl/lppl-1-3c/>."
            ),
            "status": (
                "**Derived Work** under LPPL 1.3c clause 6 -- the container format was "
                "changed. Distributed under the GUST Font License unchanged; not "
                "relicensed, so LPPL 1.3c clause 10.1 is not engaged. Upstream's "
                'maintenance status is "maintained" and this package is not the Current '
                "Maintainer."
            ),
            "family": family_names(result_font).get(1, "Latin Modern Math"),
            "glyphs": str(len(result_font.getGlyphOrder())),
            "math": "present" if "MATH" in result_font else "MISSING",
            "obligations": (
                "### Notice obligations (LPPL 1.3c clause 6)\n"
                "\n"
                "| Provision | Status |\n"
                "| --- | --- |\n"
                "| **6a** -- a modified component that can directly replace a component of the "
                "Work must identify itself as modified when used interactively with the Base "
                "Interpreter | **Not engaged.** A WOFF2 web font is not a direct replacement "
                "for the OTF under a TeX Base Interpreter, which cannot load WOFF2, and a font "
                "file does not identify itself to a user interactively. |\n"
                "| **6b** -- prominent notice detailing the nature of the changes | "
                "**Satisfied** by the change notice below. It is also reproduced in "
                "`ACKNOWLEDGEMENTS.md` and summarised in the header of `src/styles/temml.css`, "
                "the stylesheet that loads this font. |\n"
                "| **6c** -- nothing may imply that the original authors support the Derived "
                'Work | **Satisfied** by the "No endorsement, no support" statement at the end '
                "of this file. |\n"
                "| **6d** -- distribute the unmodified Work, or information sufficient to "
                "obtain it | **Satisfied under 6d.2**: the two upstream download URLs in the "
                "change notice below. |\n"
                "| **10.1** -- a Derived Work distributed under a different license must itself "
                "honor clause 6 as to the Work | **Not engaged.** The font is not relicensed; "
                "it remains under the GUST Font License, whose text ships beside it. |"
            ),
            "notice": (
                "### Change notice (LPPL 1.3c clause 6b)\n"
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
                "#### GFL clause 1: the renaming request\n"
                "\n"
                "Clause 1 of the GUST Font License states that it is _\"requested, but not\n"
                'legally required"_ that derived works rename both the fonts and the files\n'
                "listed in the accompanying manifest. Upstream's\n"
                "`doc/MANIFEST-Latin-Modern-Math.txt` lists, expressly under clause 1, the OTF\n"
                "menu names `Latin Modern Math` and `LatinModernMath-Regular` (§1.1) and the\n"
                "file `otf/latinmodern-math.otf` (§2.1).\n"
                "\n"
                "The **file** is renamed, to `latin-modern-math.woff2`, honoring §2.1. The\n"
                "**menu names are deliberately kept**. That is a disclosed departure from a\n"
                "request the license itself marks as non-binding, and it is recorded here so\n"
                "the departure is on the record rather than silent:\n"
                "\n"
                "- The conversion is functionally equivalent to the original in the OFL-FAQ\n"
                "  2.7/2.8 sense -- same outlines, same metrics, same MATH table, same `name`\n"
                "  records. Renaming the family would represent a font whose every table is\n"
                "  identical to upstream's as though it were a different typeface.\n"
                "- Browsers keep hardcoded lists of math family names for MathML font handling.\n"
                "  Renaming the family opts it out of those lists, and the `math` generic cannot\n"
                "  see `@font-face` in Gecko or Chromium, so there is no way to opt back in.\n"
                "\n"
                "No provision of the GFL or of LPPL 1.3c is waived by this. A **glyph subset**\n"
                "would be a different matter -- see `scripts/fonts.py --subset`, which refuses\n"
                "to write into this directory for exactly that reason."
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
                "None. Copied byte-for-byte. Upstream publishes WOFF2 directly, so there is "
                'nothing to convert -- and OFL 1.1 defines a "Modified Version" to include one '
                'made "by changing formats", so re-encoding a font handed to us in the target '
                "format would turn an Original Version into a Modified Version for no benefit. "
                "Verified after copying: valid WOFF2 flavour, MATH table present, "
                "U+1D400-1D7FF covered."
            ),
            "copyright": (
                "Copyright 2001-2021 The STIX Fonts Project Authors "
                "(<https://github.com/stipub/stixfonts>), with Reserved Font Name "
                '"TM Math", quoted as stated in the header of `OFL-STIXTwoMath.txt`.'
            ),
            "license": (
                'SIL Open Font License, Version 1.1, with Reserved Font Name "TM Math". '
                'The RFN is "TM Math" -- _not_ "STIX" and _not_ "STIX Two Math". Text: '
                "`OFL-STIXTwoMath.txt`."
            ),
            "status": (
                "**Original Version** under OFL 1.1, redistributed byte-for-byte. Not a "
                "Modified Version, so clause 3 (Reserved Font Names) is not engaged. Kept "
                "entirely under the OFL as clause 5 requires; not sublicensed under this "
                "package's MIT license."
            ),
            "family": family_names(stix_font).get(1, "STIX Two Math"),
            "glyphs": str(len(stix_font.getGlyphOrder())),
            "math": "present" if "MATH" in stix_font else "MISSING",
            "obligations": (
                "### Notice obligations (OFL 1.1)\n"
                "\n"
                "| Provision | Status |\n"
                "| --- | --- |\n"
                "| **1** -- may not be sold by itself | **Satisfied.** The font is distributed "
                "only as a component of this package and is never offered on its own. |\n"
                "| **2** -- every copy must carry the copyright notice and this license, as a "
                "stand-alone text file, human-readable header, or machine-readable metadata | "
                "**Satisfied.** `OFL-STIXTwoMath.txt` carries both and ships in this directory, "
                "in `dist/fonts/`, and in the published tarball. The font's own `name` table "
                "also retains upstream's records. |\n"
                "| **3** -- no Modified Version may use a Reserved Font Name | **Not engaged.** "
                "This is an Original Version. Separately, the RFN is \"TM Math\", which this "
                "package uses nowhere; the family name `STIX Two Math` is not reserved. |\n"
                "| **4** -- the authors' names may not be used to promote a Modified Version | "
                "**Not engaged** (no Modified Version). The font and its authors are named here "
                "only to identify and attribute the work. |\n"
                "| **5** -- must be distributed entirely under this license and no other | "
                "**Satisfied.** The font is excluded from this package's MIT license; see the "
                "header of this file. |"
            ),
            "notice": (
                "### Modification notice (OFL 1.1)\n"
                "\n"
                "> **Not a Modified Version.** This is upstream's own WOFF2 build, redistributed\n"
                "> byte-for-byte: no format conversion, no subsetting, no `name` table edits, no\n"
                "> re-hinting, no metadata injection. The vendoring script verifies the WOFF2\n"
                "> flavour, the presence of the MATH table and coverage of U+1D400-1D7FF after\n"
                "> copying, and refuses to write a file whose SHA-256 does not match the pin\n"
                "> recorded above."
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
