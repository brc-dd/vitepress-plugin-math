# Credits

This project stands on prior art. Code that was adapted (never copied wholesale) and test
corpora that were ported are credited here with their licenses. This page mirrors
[ACKNOWLEDGEMENTS.md](https://github.com/brc-dd/vitepress-plugin-math/blob/main/ACKNOWLEDGEMENTS.md)
in the repository, which is the authoritative copy.

## Parser lineage

The charCode-based delimiter scanning approach in
[`src/parser/`](https://github.com/brc-dd/vitepress-plugin-math/tree/main/src/parser)
descends from:

- **markdown-it-katex** — MIT © 2016 Waylon Flinn — the common ancestor of the ecosystem's
  `$`/`$$` rules (word-boundary opener checks, backslash-parity closer scan).
- **@mdit/plugin-tex** ([mdit-plugins](https://github.com/mdit-plugins/mdit-plugins)) — MIT
  © 2022-present Mr.Hope — `posMax` clamping, whitespace-literal-`$` heuristic, split
  registration of `$` rules (after `escape`) vs bracket rules (before `escape`).
- **markdown-it-math** — MIT © 2015 Rúnar Berg Baugsson Sigríðarson — longest-first delimiter
  precedence and closing-line indentation guards.
- **markdown-it-dollarmath** — MIT © 2021 Chris Sewell — blank-line rejection inside `$$`
  blocks and the `$$…$$ (label)` syntax (itself derived from
  [MyST-Parser](https://github.com/executablebooks/MyST-Parser), BSD-3-Clause
  © ExecutableBooks).

## Client helpers

- **KaTeX copy-tex** — MIT © 2013–2020 Khan Academy, extension by Eric Demaine — the
  expand-selection → clone → replace-with-TeX algorithm behind
  [`src/client/copy-tex.ts`](https://github.com/brc-dd/vitepress-plugin-math/blob/main/src/client/copy-tex.ts)
  (reimplemented with fixes; see the file header).
- **Temml copy-tex / temmlPostProcess** — MIT © 2020 Ron Kok — the Temml variant of the
  above, and the `\ref`/`\eqref` post-processing that `useTemmlRefs` loads at runtime.

## Styles

- **Temml stylesheets** — MIT © 2020 Ron Kok —
  [`src/styles/temml.css`](https://github.com/brc-dd/vitepress-plugin-math/tree/main/src/styles)
  adapts Temml's distributed CSS (metrics, display/equation-number rules) to VitePress.
- **KaTeX stylesheet** — MIT © 2013–2020 Khan Academy — imported as-is from the `katex`
  package by
  [`src/styles/katex.css`](https://github.com/brc-dd/vitepress-plugin-math/blob/main/src/styles/katex.css).
- The `local()`-first `@font-face` pattern follows Frédéric Wang's
  [MathFonts](https://github.com/fred-wang/MathFonts) stylesheets (MPL-2.0; pattern only, no
  code copied).

## Test corpora

Fixtures under
[`test/fixtures/`](https://github.com/brc-dd/vitepress-plugin-math/tree/main/test/fixtures)
adapt cases from (per-file headers carry the details):

- **markdown-it-dollarmath** — MIT © 2021 Chris Sewell; derived from MyST-Parser
  (BSD-3-Clause © ExecutableBooks)
- **@vscode/markdown-it-katex** — MIT © Microsoft Corporation
- **@mdit/plugin-tex** — MIT © 2022-present Mr.Hope
- **markdown-it-math** — MIT © 2015 Rúnar Berg Baugsson Sigríðarson

## Engines

MathJax (Apache-2.0), KaTeX (MIT; fonts SIL OFL 1.1), Temml (MIT), and
@webc.site/math (MulanPSL-2.0) are consumed as optional peer dependencies — never bundled,
never adapted. Fonts vendored in
[`src/fonts/`](https://github.com/brc-dd/vitepress-plugin-math/tree/main/src/fonts) come from
their canonical upstreams (GUST, STIX) with license texts and a provenance manifest beside
them.

## Fonts

Both vendored fonts are the **unmodified upstream font**: no glyph subsetting, no `name`
table edits, no re-hinting, no metadata injection. Full provenance — sources, upstream
SHA-256 hashes, versions and the verification the generator script performs — is recorded in
[`src/fonts/MANIFEST.md`](https://github.com/brc-dd/vitepress-plugin-math/blob/main/src/fonts/MANIFEST.md).

### Latin Modern Math

Copyright 2012-2014 for TeX Gyre math extensions by B. Jackowski, P. Strzelczyk and
P. Pianowski (on behalf of TeX Users Groups). Distributed under the **GUST Font License
(GFL)**, legally equivalent to LPPL 1.3c; the license text is vendored as
[`GUST-FONT-LICENSE.txt`](https://github.com/brc-dd/vitepress-plugin-math/blob/main/src/fonts/GUST-FONT-LICENSE.txt).

Change notice (GUST Font License / LPPL 1.3c clause 6b):

> **This is a Derived Work.** The only change is the container format: the OpenType/CFF file
> `latinmodern-math-1959/otf/latinmodern-math.otf` from `latinmodern-math-1959.zip` was
> converted to WOFF2 with fontTools 4.63.0. No glyph outlines, metrics, MATH table entries,
> `name` records, `cmap` coverage or any other font data were altered, added or removed, and
> `head.modified` is left at the value GUST shipped. The script asserts all of that after
> every conversion.
>
> A complete, unmodified copy of the Work is obtainable from the GUST e-foundry at
> <https://www.gust.org.pl/projects/e-foundry/lm-math/download/latinmodern-math-1959.zip> and
> from CTAN at <https://mirrors.ctan.org/fonts/lm-math.zip> (LPPL 1.3c clause 6d.2).

The GFL's clause-1 renaming request is marked in the license itself as requested but not
legally required. The file is renamed; the menu names are deliberately kept, and that
departure is disclosed and reasoned in the manifest.

### STIX Two Math

Copyright 2001-2021 The STIX Fonts Project Authors. Distributed under the **SIL Open Font
License 1.1** with the Reserved Font Name "TM Math" — note that the RFN is "TM Math", not
"STIX" or "STIX Two Math". The license text is vendored as
[`OFL-STIXTwoMath.txt`](https://github.com/brc-dd/vitepress-plugin-math/blob/main/src/fonts/OFL-STIXTwoMath.txt).
STIX Fonts™ is a trademark of the IEEE.

Modification notice (OFL 1.1):

> Not modified. This is the upstream WOFF2 build, unaltered.

Neither project endorses, supports or is responsible for this package or the files in that
directory (LPPL 1.3c clause 6c).

## Full license texts

MIT (Waylon Flinn, Mr.Hope, Rúnar Berg Baugsson Sigríðarson, Chris Sewell, Khan Academy,
Ron Kok, Microsoft Corporation):

> Permission is hereby granted, free of charge, to any person obtaining a copy of this
> software and associated documentation files (the "Software"), to deal in the Software
> without restriction, including without limitation the rights to use, copy, modify, merge,
> publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
> to whom the Software is furnished to do so, subject to the following conditions: The above
> copyright notice and this permission notice shall be included in all copies or substantial
> portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
> EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
> FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
> HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
> CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
> USE OR OTHER DEALINGS IN THE SOFTWARE.

BSD-3-Clause (ExecutableBooks / MyST-Parser): see
<https://github.com/executablebooks/MyST-Parser/blob/master/LICENSE>.

The plugin itself is [MIT](https://github.com/brc-dd/vitepress-plugin-math/blob/main/LICENSE)
© Divyansh Singh. Vendored fonts keep their own licenses.
