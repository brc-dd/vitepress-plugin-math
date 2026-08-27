# Third-Party Notices

`vitepress-plugin-math` is licensed under the MIT License, Copyright (c) 2026-present
Divyansh Singh ([`LICENSE`](LICENSE)). This file is the notice register for third-party
material and is distributed with the package.

Entries are grouped by the obligation they carry:

- [1. Adapted material](#1-adapted-material) — third-party expression is present in this
  package's source. The upstream copyright notice and permission notice are reproduced under
  [§5](#5-license-texts) as those licenses require.
- [2. Vendored fonts](#2-vendored-fonts) — third-party binaries are redistributed verbatim or
  as a disclosed derived work, under their own licenses, which travel with them.
- [3. Dependencies not redistributed](#3-dependencies-not-redistributed) — resolved from the
  consumer's own `node_modules`. Nothing from them is copied into this package, so their
  redistribution conditions are not triggered here; they are recorded for completeness.
- [4. Referenced without copying](#4-referenced-without-copying) — technique or behavior was
  studied. No expression was taken and no obligation arises; credited on the merits.

Copyright lines are quoted as the named upstream states them. Every claim below was checked
against the upstream license file; sources are listed with each entry.

## 1. Adapted material

### 1.1 Parser rules — `src/parser/`

Portions of [`src/parser/inline.ts`](src/parser/inline.ts) and
[`src/parser/block.ts`](src/parser/block.ts) are adapted from the works listed below. The
delimiter-scanning approach is common to all four; the specific behavior taken from each is
identified so the scope of the adaptation is not overstated.

| Work | Copyright | License |
| --- | --- | --- |
| [markdown-it-katex](https://github.com/waylonflinn/markdown-it-katex) | Copyright (c) 2016 Waylon Flinn | MIT |
| [`@mdit/plugin-tex`](https://github.com/mdit-plugins/mdit-plugins) | Copyright (C) 2022 - PRESENT by MrHope | MIT |
| [markdown-it-math](https://github.com/runarberg/markdown-it-math) | Copyright (c) 2015 Rúnar Berg Baugsson Sigríðarson | MIT |
| [markdown-it-dollarmath](https://github.com/executablebooks/markdown-it-dollarmath) | Copyright (c) 2021 Chris Sewell | MIT |

Adapted from **markdown-it-katex**: the charCode-based `$`/`$$` scanning structure that the
other three also descend from — word-boundary checks on the opening delimiter and the
backslash-parity scan for the closing delimiter.

Adapted from **`@mdit/plugin-tex`**: `posMax` clamping of the closer scan, the
whitespace-flanked literal-`$` heuristic, and the split rule registration that installs the
`$` rules after markdown-it's `escape` rule and the bracket rules before it.

Adapted from **markdown-it-math**: longest-first delimiter precedence, and the indentation
guards applied to the closing line of a block.

Adapted from **markdown-it-dollarmath**: rejection of blank lines inside a `$$` block, and
the `$$…$$ (label)` trailing-label syntax. That syntax originates in
[MyST-Parser](https://github.com/executablebooks/MyST-Parser), Copyright (c) 2020
ExecutableBookProject, MIT.

Sources checked: `LICENSE` at
<https://github.com/waylonflinn/markdown-it-katex/blob/master/LICENSE>,
<https://github.com/mdit-plugins/mdit-plugins/blob/main/LICENSE>,
<https://github.com/runarberg/markdown-it-math/blob/main/LICENCE>,
<https://github.com/executablebooks/markdown-it-dollarmath/blob/main/LICENSE>,
<https://github.com/executablebooks/MyST-Parser/blob/master/LICENSE>.

### 1.2 Copy-as-TeX — `src/client/copy-tex.ts`

Portions of [`src/client/copy-tex.ts`](src/client/copy-tex.ts) are adapted from the
`copy-tex` contrib extension of **KaTeX**, Copyright (c) 2013-2020 Khan Academy and other
contributors, licensed under the MIT License. That extension was contributed by Erik Demaine
(KaTeX pull request
[#813](https://github.com/KaTeX/KaTeX/pull/813), 2017) and is covered by KaTeX's own license;
it carries no separate license file.

The material adapted is the algorithm: expand the selection to whole formula roots, clone the
resulting fragment, and replace each rendered formula in the clone with its TeX annotation
wrapped in delimiters. The implementation here is a rewrite, not a copy — it clones the range
before expanding it, probes root selectors outermost-first, matches annotations by encoding,
preserves block boundaries for display math, and applies the display delimiters.

The MathML form of the same algorithm in **Temml**'s `contrib/copy-tex`, Copyright (c) 2020
Ron Kok, licensed under the MIT License, was also consulted; Temml's source describes itself
as "Mostly, a copy of Eric Demaine's copy-tex extension for KaTex".

Sources checked: `LICENSE` at <https://github.com/KaTeX/KaTeX/blob/main/LICENSE> (also
`node_modules/katex/LICENSE`, katex@0.18.4) and
<https://github.com/ronkok/Temml/blob/main/LICENSE> (also `node_modules/temml/LICENSE`,
temml@0.13.4).

### 1.3 Stylesheets — `src/styles/`

[`src/styles/temml.css`](src/styles/temml.css) is adapted from Temml's distributed
`dist/Temml-Latin-Modern.css`, and
[`src/styles/temml-stix2.css`](src/styles/temml-stix2.css) from Temml's distributed
`dist/Temml-STIX2.css` — both Copyright (c) 2020 Ron Kok, licensed under the MIT License.
Each file carries a header comment enumerating its changes from upstream; those headers are
part of the notice and must be preserved in any redistribution of the CSS.

Source checked: <https://github.com/ronkok/Temml/blob/main/LICENSE> (also
`node_modules/temml/LICENSE`, temml@0.13.4).

### 1.4 Test corpora — `test/fixtures/`

The Markdown inputs in [`test/fixtures/`](test/fixtures) are adapted from the test suites
listed below. Only inputs were taken; the expected output in every fixture is this project's
own and deliberately differs from each upstream. Each fixture file names its sources in a
header comment.

| Work | Copyright | License |
| --- | --- | --- |
| [markdown-it-dollarmath](https://github.com/executablebooks/markdown-it-dollarmath) | Copyright (c) 2021 Chris Sewell | MIT |
| [`@vscode/markdown-it-katex`](https://github.com/microsoft/vscode-markdown-it-katex) | Copyright (c) Microsoft Corporation; Copyright (c) 2018 Takahiro Ethan Ikeuchi @iktakahiro; Copyright (c) 2016 Waylon Flinn | MIT |
| [`@mdit/plugin-tex`](https://github.com/mdit-plugins/mdit-plugins) | Copyright (C) 2022 - PRESENT by MrHope | MIT |
| [markdown-it-math](https://github.com/runarberg/markdown-it-math) | Copyright (c) 2015 Rúnar Berg Baugsson Sigríðarson | MIT |

The markdown-it-dollarmath cases derive from
[MyST-Parser](https://github.com/executablebooks/MyST-Parser), Copyright (c) 2020
ExecutableBookProject, MIT.

Source checked: <https://github.com/microsoft/vscode-markdown-it-katex/blob/main/LICENSE>,
which carries all three copyright lines quoted above; remaining sources as listed in §1.1.

## 2. Vendored fonts

The two WOFF2 files in [`src/fonts/`](src/fonts) (published as `dist/fonts/`) are third-party
font software redistributed under their own licenses. They are **not** covered by this
package's MIT License. The full license text of each accompanies it in the same directory, as
both licenses require, and
[`src/fonts/MANIFEST.md`](src/fonts/MANIFEST.md) is the provenance record: upstream source
URL, pinned SHA-256, version, the transformation applied, and the notice satisfying each
obligation.

### 2.1 Latin Modern Math — `latin-modern-math.woff2`

Copyright 2012--2014 for TeX Gyre math extensions by B. Jackowski, P. Strzelczyk and
P. Pianowski (on behalf of TeX Users Groups). Licensed under the **GUST Font License (GFL)**,
which places the work under the LaTeX Project Public License, version 1.3c or later. License
text: [`src/fonts/GUST-FONT-LICENSE.txt`](src/fonts/GUST-FONT-LICENSE.txt).

The file redistributed here is a **Derived Work** under LPPL 1.3c: the upstream
OpenType/CFF font was converted to the WOFF2 container. No other font data was changed.
LPPL 1.3c clause 6b (prominent change notice) and clause 6d.2 (information sufficient to
obtain a complete, unmodified copy of the Work) are satisfied by the change notice in
[`src/fonts/MANIFEST.md`](src/fonts/MANIFEST.md), which also carries the clause 6c statement
that the upstream authors provide no support for this Derived Work. The font remains
available under the GUST Font License; nothing here relicenses it.

GFL clause 1 *requests, but does not legally require*, that a derived work rename the fonts
and files named in the upstream manifest. The file is renamed; the OTF menu names are kept.
The manifest records that departure and its reasons.

Source checked: `doc/GUST-FONT-LICENSE.txt` and `doc/MANIFEST-Latin-Modern-Math.txt` inside
<https://www.gust.org.pl/projects/e-foundry/lm-math/download/latinmodern-math-1959.zip>;
LPPL 1.3c at <https://www.latex-project.org/lppl/lppl-1-3c/>.

### 2.2 STIX Two Math — `stix-two-math.woff2`

Copyright 2001-2021 The STIX Fonts Project Authors
(<https://github.com/stipub/stixfonts>), with Reserved Font Name "TM Math". Licensed under
the **SIL Open Font License, Version 1.1**. License text:
[`src/fonts/OFL-STIXTwoMath.txt`](src/fonts/OFL-STIXTwoMath.txt). STIX Fonts™ is a trademark
of The Institute of Electrical and Electronics Engineers, Inc.

The file redistributed here is the upstream WOFF2 build, copied byte-for-byte. It is an
Original Version, not a Modified Version, under OFL 1.1 — so clause 3 (no Modified Version
may use a Reserved Font Name) is not engaged, and the family name `STIX Two Math` is used
unchanged. The Reserved Font Name is "TM Math", which this package does not use for anything.
OFL 1.1 clause 2 is satisfied by shipping the copyright notice and license alongside the
font; clause 1 by never offering the font by itself; clause 5 by leaving the font under the
OFL rather than sublicensing it under this package's MIT License.

Source checked: `OFL.txt` at
<https://github.com/stipub/stixfonts/blob/v2.13b171/OFL.txt>, which matches the vendored copy.

## 3. Dependencies not redistributed

The rendering engines are optional peer dependencies. They are loaded from the consumer's own
installation at build or run time; no part of any of them is bundled, vendored, or adapted
into this package. Each therefore reaches the consumer under its own license, direct from its
own publisher, and this package's distribution triggers none of their redistribution
conditions. Adapters in [`src/engines/`](src/engines) are original work, written against
public APIs.

| Engine | Copyright | License |
| --- | --- | --- |
| [MathJax](https://github.com/mathjax/MathJax-src) | Copyright (c) The MathJax Consortium | Apache-2.0 |
| [KaTeX](https://github.com/KaTeX/KaTeX) | Copyright (c) 2013-2020 Khan Academy and other contributors | MIT |
| [Temml](https://github.com/ronkok/Temml) | Copyright (c) 2020 Ron Kok | MIT |
| [`@webc.site/math`](https://github.com/webc-site/math) | i18n.site (`i18n.site@gmail.com`) | MulanPSL-2.0 |

Two consequences worth stating explicitly:

**`@webc.site/math` is integrated through its public API only.** No code, and no derivative of
any code, from `@webc.site/math` appears in this package. MulanPSL-2.0 §4 conditions the
distribution of that Software — modified or not — on supplying recipients a copy of the
license and retaining its notices; because this package distributes none of it, that
condition does not attach here, and MulanPSL-2.0 terms are not propagated into this
MIT-licensed package. Consumers who install the optional peer dependency receive it from its
own publisher under MulanPSL-2.0.

**MathJax and KaTeX assets are referenced, not copied.** [`src/styles/katex.css`](src/styles/katex.css)
`@import`s `katex/dist/katex.min.css` from the consumer's installed `katex` package; KaTeX's
stylesheet and its fonts (SIL OFL 1.1) are never vendored here. MathJax is loaded the same
way; because this package redistributes no part of it, Apache-2.0 §4 (notice retention and
`NOTICE` propagation) is not triggered.

Sources checked: `package.json` `license` fields and bundled `LICENSE` files of
mathjax@4.1.3, katex@0.18.4, temml@0.13.4 and @webc.site/math@0.1.34 as installed;
MulanPSL-2.0 text at <https://spdx.org/licenses/MulanPSL-2.0.html>; MathJax copyright line
from the MathJax-src source headers and its `package.json` contributor entry
(`MathJax Consortium <info@mathjax.org>`).

## 4. Referenced without copying

The `local()`-first `@font-face` pattern in [`src/styles/`](src/styles) — list installed
copies before the network URL, so a reader who already has the font downloads nothing —
follows the stylesheets in Frédéric Wang's
[MathFonts](https://github.com/fred-wang/MathFonts), which is licensed under MPL-2.0. The
pattern is a CSS technique, not expression taken from that project; no MathFonts code is
present here and MPL-2.0 §3 is not engaged. Credited because the idea is theirs.

## 5. License texts

### MIT License

Applies to: markdown-it-katex (Copyright (c) 2016 Waylon Flinn); `@mdit/plugin-tex`
(Copyright (C) 2022 - PRESENT by MrHope); markdown-it-math (Copyright (c) 2015 Rúnar Berg
Baugsson Sigríðarson); markdown-it-dollarmath (Copyright (c) 2021 Chris Sewell); MyST-Parser
(Copyright (c) 2020 ExecutableBookProject); `@vscode/markdown-it-katex` (Copyright (c)
Microsoft Corporation; Copyright (c) 2018 Takahiro Ethan Ikeuchi @iktakahiro; Copyright (c)
2016 Waylon Flinn); KaTeX (Copyright (c) 2013-2020 Khan Academy and other contributors);
Temml (Copyright (c) 2020 Ron Kok).

> Permission is hereby granted, free of charge, to any person obtaining a copy of this
> software and associated documentation files (the "Software"), to deal in the Software
> without restriction, including without limitation the rights to use, copy, modify, merge,
> publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
> to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
> INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
> PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
> FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
> OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
> DEALINGS IN THE SOFTWARE.

### GUST Font License (LPPL 1.3c)

Applies to: Latin Modern Math. Full text is distributed with the font at
[`src/fonts/GUST-FONT-LICENSE.txt`](src/fonts/GUST-FONT-LICENSE.txt) (`dist/fonts/` in the
published package). LPPL 1.3c: <https://www.latex-project.org/lppl/lppl-1-3c/>.

### SIL Open Font License 1.1

Applies to: STIX Two Math. Full text, with the STIX copyright header, is distributed with the
font at [`src/fonts/OFL-STIXTwoMath.txt`](src/fonts/OFL-STIXTwoMath.txt) (`dist/fonts/` in
the published package).

### Apache License 2.0 and MulanPSL-2.0

Apply to MathJax and `@webc.site/math` respectively. Neither is redistributed by this package
(see [§3](#3-dependencies-not-redistributed)); their texts travel with their own packages.
Apache-2.0: <https://www.apache.org/licenses/LICENSE-2.0>. MulanPSL-2.0:
<https://spdx.org/licenses/MulanPSL-2.0.html>.

### Mozilla Public License 2.0

Applies to MathFonts, which is referenced but not copied
(see [§4](#4-referenced-without-copying)). MPL-2.0:
<https://www.mozilla.org/en-US/MPL/2.0/>.
