# vitepress-plugin-math

Engine-agnostic math for [VitePress](https://vitepress.dev) — MathJax, KaTeX, Temml, or
`@webc.site/math` behind one markdown-it parser and a zero-config Vite plugin.

[![npm version](https://img.shields.io/npm/v/vitepress-plugin-math?logo=npm&label=npm)](https://www.npmjs.com/package/vitepress-plugin-math)
[![CI](https://img.shields.io/github/actions/workflow/status/brc-dd/vitepress-plugin-math/ci.yml?branch=main&logo=github&label=CI)](https://github.com/brc-dd/vitepress-plugin-math/actions/workflows/ci.yml)
[![docs](https://img.shields.io/badge/docs-brc--dd.github.io-5c73e7)](https://brc-dd.github.io/vitepress-plugin-math/)
[![license](https://img.shields.io/github/license/brc-dd/vitepress-plugin-math?label=license)](LICENSE)

## Quickstart

```bash
pnpm add -D vitepress-plugin-math katex
```

KaTeX is the recommended engine. Swap it for `mathjax`, `temml`, or `@webc.site/math` — all
four are optional peer dependencies, and with no `engine` option the first one installed
wins in the order `mathjax` → `katex` → `temml` → `webc`.

```ts
// .vitepress/config.ts
import { defineConfig } from 'vitepress'
import { math } from 'vitepress-plugin-math/vite'

export default defineConfig({
  vite: { plugins: [math({ engine: 'katex' })] },
})
```

That is the whole setup. One entry in `vite.plugins` registers the markdown rules, imports
the engine's stylesheet, serves and emits its fonts from your own deploy, and starts
copy-as-TeX — no `markdown.config` hook, no theme file, no CSS import. Your own theme is
left intact: its `setup()` still runs and `extends` chains are followed.

> **Which VitePress?** `math()` reads VitePress's *resolved* site config, which needs
> [vuejs/vitepress#5405](https://github.com/vuejs/vitepress/pull/5405). On a VitePress
> without that fix — `2.0.0-alpha.19` included — use `withMath(config, options)` instead: it
> chains onto the config object directly and is otherwise identical, same styles, same
> fonts, same client behavior, still no theme file. See
> [getting started](https://brc-dd.github.io/vitepress-plugin-math/guide/getting-started#which-vitepress-works-with-math).

## Syntax at a glance

| Input | Result |
| --- | --- |
| `$x+y$` | inline math |
| `` $`x+y`$ `` | inline math, GitHub's dollar-backtick form — a real code span, so the TeX is protected from markdown |
| `\(x+y\)` | inline math |
| `$$ … $$` / `\[ … \]` on their own lines | display math block, horizontally scrollable and focusable |
| `a $$x$$ b` / `a \[x\] b` | display math rendered mid-paragraph |
| ` ```math ` fence | display math block (attributes like ` ```math {1} ` still count) |
| `$$x$$ (label)` | display math with an `id` anchor, with [`labels: true`](https://brc-dd.github.io/vitepress-plugin-math/reference/options#labels) |
| `\$`, `$5 and $10`, `cost$5` | literal text — never math |

One markdown quirk survives: a table row is split on unescaped pipes before inline parsing
runs, so a pipe inside math has to be written `\|`. That is a table rule, not a math one —
inline code spans break the same way.

Everything GitHub renders as math, this renders as math — plus the cases GitHub silently
drops, such as escapes inside math, math in links and footnotes, and mid-paragraph display
math. Full details in the
[syntax guide](https://brc-dd.github.io/vitepress-plugin-math/guide/syntax) and the
[GitHub compatibility table](https://brc-dd.github.io/vitepress-plugin-math/guide/github-compatibility).

## Engines

Nothing is bundled and nothing ships JavaScript to the browser — every formula is typeset at
build time, and the only client code is the ~1 KB copy helper, identical for all four.

| Engine | Output | Weight | Selection & copy | Notes |
| --- | --- | --- | --- | --- |
| [**MathJax v4**](https://brc-dd.github.io/vitepress-plugin-math/guide/engines#mathjax-v4) · [example](https://brc-dd.github.io/vitepress-plugin-math/examples/mathjax/) | SVG (default) or CHTML | ~6 KB CSS, no fonts in SVG mode | assisted (SVG) · native (CHTML) | broadest TeX coverage — mhchem, physics, line-breaking, AMS `\label`/`\ref` |
| [**KaTeX**](https://brc-dd.github.io/vitepress-plugin-math/guide/engines#katex) · [example](https://brc-dd.github.io/vitepress-plugin-math/examples/katex/) | HTML + hidden MathML | ~25 KB CSS + woff2 from the `katex` package | native | the recommended default: fast, LaTeX-faithful, mhchem built in; `\tag` only, no `\ref` |
| [**Temml**](https://brc-dd.github.io/vitepress-plugin-math/guide/engines#temml) · [example](https://brc-dd.github.io/vitepress-plugin-math/examples/temml/) | MathML | ~9 KB CSS + one vendored math font | native | smallest markup by far; most extensions built in; CSS-counter numbering |
| [**@webc.site/math**](https://brc-dd.github.io/vitepress-plugin-math/guide/engines#webc-site-math) · [example](https://brc-dd.github.io/vitepress-plugin-math/examples/webc/) | MathML | ~9 KB CSS, same font | native | minimum payload, thin coverage — no `\binom`, `\color`, physics or mhchem |

One honest caveat: **MathJax's default SVG output contains no text**, so the browser has
nothing to select. Those formulas — and only those — get an assisted layer instead:
double-click (or long-press) marks the whole formula with a visible highlight so a plain
copy grabs its TeX, and display math is focusable for a keyboard copy. Every other engine
keeps its native selection untouched.

Bring your own renderer if none of the four fit: anything implementing
[`MathRenderer`](https://brc-dd.github.io/vitepress-plugin-math/guide/advanced#custom-renderers)
— `render(tex, ctx)` plus optional `reset` / `stylesheet` / `finalize` hooks — can back the
parser. The [engines guide](https://brc-dd.github.io/vitepress-plugin-math/guide/engines)
has the full comparison, including per-engine options.

## Why this one

- **Its own parser, not a wrapper.** Mid-paragraph display math, trailing punctuation after
  a block closer, ` ```math {1} ` fences, image alt text, non-ASCII word boundaries — each a
  real defect in one or more of the widely used plugins, fixed here and pinned by
  whitespace-exact fixtures.
- **An unclosed `$$` can never swallow your page.** A blank line ends the search for a
  closer, so a typo costs you one paragraph, not the rest of the document.
- **Stateless per page.** AMS numbering, `\gdef` macros and labels reset on every render, so
  HMR never leaks equation numbers or raises duplicate-label errors.
- **Errors that keep the dev server alive.** A formula the engine rejects becomes an inline
  placeholder carrying the message, and the build continues; a missing engine fails loudly
  with the package to install, as an overlay in dev and a failed `vitepress build`. Flip
  either with [`throwOnError`](https://brc-dd.github.io/vitepress-plugin-math/reference/options#throwonerror).
- **Self-hosted fonts, no CDN.** Stylesheets and webfonts are served and emitted from your
  own deploy, with licenses and provenance tracked in the repo. The one exception is
  webcontainers, where VitePress asks for CDN fonts itself.
- **Copy as TeX, everywhere.** Every wrapper carries `data-tex`, so selecting a formula and
  copying gives back the source you wrote — on every engine, even for expressions that
  failed to render.

## Links

- **[Documentation](https://brc-dd.github.io/vitepress-plugin-math/)** — the deep version of
  everything above.
- [Options](https://brc-dd.github.io/vitepress-plugin-math/reference/options) ·
  [API](https://brc-dd.github.io/vitepress-plugin-math/reference/api) ·
  [Advanced wiring](https://brc-dd.github.io/vitepress-plugin-math/guide/advanced) —
  `applyMath()` for a plain `markdown.config` hook, `mathPlugin()` for any markdown-it.
- [Copy and accessibility](https://brc-dd.github.io/vitepress-plugin-math/guide/copy-and-a11y)
  · [Architecture](https://brc-dd.github.io/vitepress-plugin-math/about/architecture) — how
  selection, screen readers and the wrapper contract work, and why.
- Live examples, same pages through each engine:
  [MathJax](https://brc-dd.github.io/vitepress-plugin-math/examples/mathjax/) ·
  [KaTeX](https://brc-dd.github.io/vitepress-plugin-math/examples/katex/) ·
  [Temml](https://brc-dd.github.io/vitepress-plugin-math/examples/temml/) ·
  [@webc.site/math](https://brc-dd.github.io/vitepress-plugin-math/examples/webc/)

## License

[MIT](LICENSE), Copyright (c) 2026-present Divyansh Singh.

The vendored fonts are **not** covered by that grant: Latin Modern Math is under the GUST
Font License and STIX Two Math under SIL OFL 1.1, each shipped with its own license text and
a clause-by-clause provenance record in [`src/fonts/MANIFEST.md`](src/fonts/MANIFEST.md).
They are regenerated from their canonical upstreams by
[`scripts/fonts.py`](scripts/fonts.py) (`uv run scripts/fonts.py`), never edited by hand.

The rendering engines are optional peer dependencies and are never bundled, vendored or
adapted here, so they reach you from their own publishers under their own licenses.

[ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md) is the full third-party notice register — adapted
code, ported test corpora, font notices and the reproduced license texts. It ships inside the
npm package.
