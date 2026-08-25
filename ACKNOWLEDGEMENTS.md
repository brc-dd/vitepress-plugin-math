# Acknowledgements

This project stands on prior art. Code that was adapted (never copied wholesale) and test
corpora that were ported are credited here with their licenses. Vendored font licenses live
alongside the fonts in [`src/fonts/`](src/fonts).

## Parser lineage

The charCode-based delimiter scanning approach in [`src/parser/`](src/parser) descends from:

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
  [`src/client/copy-tex.ts`](src/client/copy-tex.ts) (reimplemented with fixes; see the file
  header).
- **Temml copy-tex / temmlPostProcess** — MIT © 2020 Ron Kok — the Temml variant of the
  above, and the `\ref`/`\eqref` post-processing that `useTemmlRefs` loads at runtime.

## Styles

- **Temml stylesheets** — MIT © 2020 Ron Kok — [`src/styles/temml.css`](src/styles) adapts
  Temml's distributed CSS (metrics, display/equation-number rules) to VitePress.
- **KaTeX stylesheet** — MIT © 2013–2020 Khan Academy — imported as-is from the `katex`
  package by [`src/styles/katex.css`](src/styles/katex.css).
- The `local()`-first `@font-face` pattern follows Frédéric Wang's
  [MathFonts](https://github.com/fred-wang/MathFonts) stylesheets (MPL-2.0; pattern only, no
  code copied).

## Test corpora

Fixtures under [`test/fixtures/`](test/fixtures) adapt cases from (per-file headers carry
the details):

- **markdown-it-dollarmath** — MIT © 2021 Chris Sewell; derived from MyST-Parser
  (BSD-3-Clause © ExecutableBooks)
- **@vscode/markdown-it-katex** — MIT © Microsoft Corporation
- **@mdit/plugin-tex** — MIT © 2022-present Mr.Hope
- **markdown-it-math** — MIT © 2015 Rúnar Berg Baugsson Sigríðarson

## Engines

MathJax (Apache-2.0), KaTeX (MIT; fonts SIL OFL 1.1), Temml (MIT), and
@webc.site/math (MulanPSL-2.0) are consumed as optional peer dependencies — never bundled,
never adapted. Fonts vendored in [`src/fonts/`](src/fonts) come from their canonical
upstreams (GUST, STIX) with license texts and a provenance manifest beside them.

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
