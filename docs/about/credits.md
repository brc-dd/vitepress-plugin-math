# Credits

This project stands on prior art, and the people below did the hard parts first.

This page is the readable version. The authoritative notice register is
[ACKNOWLEDGEMENTS.md](https://github.com/brc-dd/vitepress-plugin-math/blob/main/ACKNOWLEDGEMENTS.md),
which ships inside the npm package; every legal statement here matches it. Where the two
could ever be read differently, that file governs.

`vitepress-plugin-math` itself is
[MIT](https://github.com/brc-dd/vitepress-plugin-math/blob/main/LICENSE), Copyright (c)
2026-present Divyansh Singh. The vendored fonts are not — they keep their own licenses,
described below.

## Code we adapted

Third-party expression is present in these files. The upstream copyright and permission
notices are reproduced in
[ACKNOWLEDGEMENTS.md §5](https://github.com/brc-dd/vitepress-plugin-math/blob/main/ACKNOWLEDGEMENTS.md#5-license-texts).

### The parser

Every `$`/`$$` plugin in this ecosystem descends from the same charCode-scanning idea, and
so does [`src/parser/`](https://github.com/brc-dd/vitepress-plugin-math/tree/main/src/parser).
Portions of it are adapted, under the MIT License, from:

- **[markdown-it-katex](https://github.com/waylonflinn/markdown-it-katex)** — Copyright (c)
  2016 Waylon Flinn. The common ancestor: word-boundary checks on the opening delimiter and
  the backslash-parity scan for the closing one.
- **[`@mdit/plugin-tex`](https://github.com/mdit-plugins/mdit-plugins)** —
  Copyright (C) 2022 - PRESENT by MrHope. `posMax` clamping, the whitespace-flanked
  literal-`$` heuristic, and registering the `$` rules after markdown-it's `escape` rule while
  the bracket rules go before it.
- **[markdown-it-math](https://github.com/runarberg/markdown-it-math)** — Copyright (c) 2015
  Rúnar Berg Baugsson Sigríðarson. Longest-first delimiter precedence, and the indentation
  guards on a block's closing line.
- **[markdown-it-dollarmath](https://github.com/executablebooks/markdown-it-dollarmath)** —
  Copyright (c) 2021 Chris Sewell. Blank-line rejection inside `$$` blocks, and the
  `$$…$$ (label)` syntax — which originates in
  [MyST-Parser](https://github.com/executablebooks/MyST-Parser), Copyright (c) 2020
  ExecutableBookProject, MIT.

### Copy as TeX

[`src/client/copy-tex.ts`](https://github.com/brc-dd/vitepress-plugin-math/blob/main/src/client/copy-tex.ts)
adapts the algorithm from KaTeX's `copy-tex` contrib extension — Copyright (c) 2013-2020 Khan
Academy and other contributors, MIT — contributed by Erik Demaine in
[KaTeX PR #813](https://github.com/KaTeX/KaTeX/pull/813). Expand the selection to whole
formula roots, clone it, swap each rendered formula for its TeX annotation.

The implementation here is a rewrite rather than a copy: it clones the range before expanding
it, probes root selectors outermost-first, matches annotations by encoding, keeps block
boundaries for display math, and actually applies the display delimiters. Temml's MathML
version of the same extension — Copyright (c) 2020 Ron Kok, MIT — was consulted too.

### Stylesheets

[`src/styles/temml.css`](https://github.com/brc-dd/vitepress-plugin-math/blob/main/src/styles/temml.css)
and
[`src/styles/temml-stix2.css`](https://github.com/brc-dd/vitepress-plugin-math/blob/main/src/styles/temml-stix2.css)
are adapted from Temml's distributed `Temml-Latin-Modern.css` and `Temml-STIX2.css` —
Copyright (c) 2020 Ron Kok, MIT. Each file's header lists exactly what changed from upstream,
and that header is part of the notice: keep it if you redistribute the CSS.

### Test corpora

The Markdown inputs under
[`test/fixtures/`](https://github.com/brc-dd/vitepress-plugin-math/tree/main/test/fixtures)
are adapted, under the MIT License, from the test suites of markdown-it-dollarmath
(Copyright (c) 2021 Chris Sewell, from MyST-Parser, Copyright (c) 2020 ExecutableBookProject),
[`@vscode/markdown-it-katex`](https://github.com/microsoft/vscode-markdown-it-katex)
(Copyright (c) Microsoft Corporation; Copyright (c) 2018 Takahiro Ethan Ikeuchi @iktakahiro;
Copyright (c) 2016 Waylon Flinn), `@mdit/plugin-tex`, and markdown-it-math.

Only the inputs were taken. The expected output in every fixture is this project's own, and
deliberately differs from each upstream — that is rather the point of having them.

## Engines, which we do not ship

MathJax, KaTeX, Temml and `@webc.site/math` are optional peer dependencies. They are loaded
from your own installation; no part of any of them is bundled, vendored, or adapted here, and
the adapters in
[`src/engines/`](https://github.com/brc-dd/vitepress-plugin-math/tree/main/src/engines) are
original work written against public APIs.

| Engine | Copyright | License |
| --- | --- | --- |
| [MathJax](https://github.com/mathjax/MathJax-src) | The MathJax Consortium | Apache-2.0 |
| [KaTeX](https://github.com/KaTeX/KaTeX) | 2013-2020 Khan Academy and other contributors | MIT |
| [Temml](https://github.com/ronkok/Temml) | 2020 Ron Kok | MIT |
| [`@webc.site/math`](https://github.com/webc-site/math) | i18n.site | MulanPSL-2.0 |

Because none of them is redistributed here, none of their redistribution conditions attaches
to this package, and you receive each one from its own publisher under its own license. That
matters most for `@webc.site/math`: it is integrated purely through its public API, no code or
derivative of its code appears in this package, and so MulanPSL-2.0 terms are not propagated
into this MIT-licensed one. KaTeX is the same story —
[`src/styles/katex.css`](https://github.com/brc-dd/vitepress-plugin-math/blob/main/src/styles/katex.css)
`@import`s `katex/dist/katex.min.css` from your `katex` install, so KaTeX's stylesheet and its
OFL 1.1 fonts are never vendored here.

## Fonts, which we do ship

Two WOFF2 files live in
[`src/fonts/`](https://github.com/brc-dd/vitepress-plugin-math/tree/main/src/fonts) and are
published as `dist/fonts/`. **They are not covered by this package's MIT license.** Each
carries its own license text in the same directory, in the published tarball as well as the
repository.

[`src/fonts/MANIFEST.md`](https://github.com/brc-dd/vitepress-plugin-math/blob/main/src/fonts/MANIFEST.md)
is the full provenance record — source URL, pinned SHA-256, upstream version, the exact
transformation applied, and a clause-by-clause account of the notice obligations. It is
generated by
[`scripts/fonts.py`](https://github.com/brc-dd/vitepress-plugin-math/blob/main/scripts/fonts.py),
which re-verifies everything on every run.

### Latin Modern Math

Copyright 2012--2014 for TeX Gyre math extensions by B. Jackowski, P. Strzelczyk and
P. Pianowski (on behalf of TeX Users Groups). Licensed under the **GUST Font License**, which
places the work under LPPL 1.3c or later; the text is vendored as
[`GUST-FONT-LICENSE.txt`](https://github.com/brc-dd/vitepress-plugin-math/blob/main/src/fonts/GUST-FONT-LICENSE.txt).

The file shipped here is a **Derived Work** under that license — the upstream OpenType/CFF
font was converted to the WOFF2 container, and nothing else about it was touched:

> **This is a Derived Work.** The only change is the container format: the OpenType/CFF file
> `latinmodern-math-1959/otf/latinmodern-math.otf` from `latinmodern-math-1959.zip` was
> converted to WOFF2 with fontTools. No glyph outlines, metrics, MATH table entries, `name`
> records, `cmap` coverage or any other font data were altered, added or removed, and
> `head.modified` is left at the value GUST shipped. The script asserts all of that after
> every conversion.
>
> A complete, unmodified copy of the Work is obtainable from the GUST e-foundry at
> <https://www.gust.org.pl/projects/e-foundry/lm-math/download/latinmodern-math-1959.zip> and
> from CTAN at <https://mirrors.ctan.org/fonts/lm-math.zip> (LPPL 1.3c clause 6d.2).

That notice satisfies LPPL 1.3c clause 6b; clause 6d.2 is met by the two download URLs, and
clause 6c by the no-endorsement statement in the manifest. The font is not relicensed — it
stays under the GUST Font License.

GFL clause 1 *requests, but expressly does not legally require*, that a derived work rename
the fonts and files named in the upstream manifest. The file is renamed
(`latin-modern-math.woff2`); the OTF menu names are deliberately kept, because the conversion
is functionally equivalent to the original and because renaming a family opts it out of the
browsers' built-in math-font lists. The manifest records that departure and its reasoning
rather than leaving it silent.

### STIX Two Math

Copyright 2001-2021 The STIX Fonts Project Authors, with Reserved Font Name "TM Math".
Licensed under the **SIL Open Font License 1.1**; the text is vendored as
[`OFL-STIXTwoMath.txt`](https://github.com/brc-dd/vitepress-plugin-math/blob/main/src/fonts/OFL-STIXTwoMath.txt).
STIX Fonts™ is a trademark of the IEEE, named here only to identify the font.

This one is upstream's own WOFF2 build, copied byte-for-byte — an **Original Version**, not a
Modified Version:

> **Not a Modified Version.** No format conversion, no subsetting, no `name` table edits, no
> re-hinting, no metadata injection.

So OFL 1.1 clause 3 is never engaged. Worth noting anyway: the Reserved Font Name is
"TM Math", not "STIX" and not "STIX Two Math", so the family name used in the stylesheet is
not reserved in the first place.

## Ideas we borrowed but did not copy

The `local()`-first `@font-face` pattern — list the reader's installed copies before the
network URL, so anyone who already has the font downloads nothing — follows the stylesheets in
Frédéric Wang's [MathFonts](https://github.com/fred-wang/MathFonts) (MPL-2.0). It is a CSS
technique rather than code, so nothing of MathFonts is present here. Credited because the idea
is his.
