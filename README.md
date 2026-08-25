# vitepress-plugin-math

Engine-agnostic math for [VitePress](https://vitepress.dev): one robust markdown-it TeX parser,
swappable typesetting engines, self-hosted styles and fonts — no CDN anywhere.

- **Engines as optional peers** — [MathJax v4](https://www.mathjax.org),
  [KaTeX](https://katex.org), [Temml](https://temml.org),
  [@webc.site/math](https://www.npmjs.com/package/@webc.site/math), or your own renderer.
  Auto-detected by priority (mathjax → katex → temml → webc), overridable.
- **A better TeX parser** than the current ecosystem: inline display math (`a $$x$$ b`),
  `\( \)` / `\[ \]` delimiters, ` ```math ` fences (with attrs), equation labels, correct
  currency/escape/table handling, math preserved in image alt text — and unclosed math can
  never swallow your document.
- **VitePress-native output**: wrappers carry `v-pre` (Vue-safe) and `data-tex` (copy-as-TeX
  for every engine), display math is keyboard-scrollable, styles align with the default theme.
- **Stateless per page**: AMS numbering, `\gdef` macros, and labels reset on every render —
  no duplicate-label errors under HMR.

## Install

```bash
pnpm add -D vitepress-plugin-math katex
```

Swap `katex` for `mathjax`, `temml`, or `@webc.site/math` — install whichever engine(s) you
want; the first installed one wins (mathjax → katex → temml → webc) unless you pick one
explicitly.

## Usage

```ts
// .vitepress/config.ts
import { defineConfig } from 'vitepress'
import { withMath } from 'vitepress-plugin-math/vite'

export default withMath(
  defineConfig({
    // your config
  }),
  { engine: 'katex' }, // optional — omit for auto-detection
)
```

Then import the engine's stylesheet in your theme:

```ts
// .vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme'
import 'vitepress-plugin-math/styles/katex.css' // katex
// import 'vitepress-plugin-math/styles/temml.css'     // temml (Latin Modern Math, self-hosted)
// import 'vitepress-plugin-math/styles/temml-stix2.css' // temml (STIX Two Math)
// import 'virtual:vitepress-plugin-math.css'          // mathjax (engine-generated, via withMath)
// import 'vitepress-plugin-math/styles/core.css'      // webc / custom renderers

export default DefaultTheme
```

Prefer wiring markdown-it yourself? Skip `withMath`:

```ts
import { defineConfig } from 'vitepress'
import { applyMath } from 'vitepress-plugin-math'

export default defineConfig({
  markdown: {
    config: (md) => applyMath(md, { engine: 'temml' }),
  },
})
```

Outside VitePress, use the low-level plugin with any markdown-it and any renderer:

```ts
import MarkdownIt from 'markdown-it'
import { mathPlugin } from 'vitepress-plugin-math'
import { createKatexRenderer } from 'vitepress-plugin-math/engines/katex'

const md = MarkdownIt()
mathPlugin(md, { renderer: await createKatexRenderer(), vPre: false })
```

## Syntax

| Input | Result |
| --- | --- |
| `$x+y$`, `\(x+y\)` | inline math |
| `$$ … $$`, `\[ … \]` (own lines) | display math block |
| `a $$x$$ b`, `a \[x\] b` | display math rendered inline |
| ` ```math ` fenced block | display math block |
| `$$x$$ (label)` | display math with a label (`labels: true`) |
| `\$`, `$5 and $10`, `5$x$` | literal text — never math |
| `$x\|y$` in tables | escape the pipe: `\|` (a markdown table rule, not ours) |

## Options

All options of [`ApplyMathOptions`](src/index.ts) / [`MathOptions`](src/types.ts):

| Option | Default | |
| --- | --- | --- |
| `engine` | auto | `'mathjax' \| 'katex' \| 'temml' \| 'webc'` or a custom `MathRenderer` |
| `delimiters` | `'all'` | `'dollars'`, `'brackets'`, or both |
| `mathFence` | `true` | treat ` ```math ` fences as display math |
| `inlineDisplay` | `true` | parse mid-paragraph `$$…$$` as inline display math |
| `allowInlineWithSpace` | `false` | allow `$ x $` (space-padded delimiters) |
| `labels` | `false` | parse `$$…$$ (label)` into `ctx.label` |
| `vPre` | `true` | `v-pre` on wrappers (required for VitePress) |
| `copySource` | `true` | `data-tex` on wrappers (powers copy-as-TeX) |
| `throwOnError` | `false` | rethrow engine errors instead of rendering an error placeholder |
| `transformTex` | — | preprocess TeX before the engine sees it |
| `mathjax` / `katex` / `temml` / `webc` | — | per-engine options (precise types in `vitepress-plugin-math/engines/*`) |

Custom engines implement [`MathRenderer`](src/types.ts) — `render(tex, ctx)` plus optional
`reset` / `stylesheet` / `finalize` hooks. Anything that turns TeX into an HTML string works.

## Client extras

SSR-safe Vue composables, called from a wrapping Layout component:

```vue
<!-- .vitepress/theme/Layout.vue -->
<script setup>
import DefaultTheme from 'vitepress/theme'
import { useCopyTex, useTemmlRefs } from 'vitepress-plugin-math/client'

useCopyTex() // selections containing math copy the original TeX ($…$ / $$…$$)
useTemmlRefs() // Temml only: resolves \ref/\eqref equation numbers
</script>

<template><DefaultTheme.Layout /></template>
```

`useCopyTex` works with every engine (it reads the wrapper's `data-tex`, falling back to
MathML annotations and MathJax's `data-latex`) — ~1 KB, one delegated listener, no
re-initialization on navigation.

## Choosing an engine

| | output | payload | notes |
| --- | --- | --- | --- |
| **MathJax v4** | SVG (default) or CHTML | no fonts (SVG); ~6 KB CSS | widest TeX coverage, line-breaking, best AT story (assistive MathML on by default) |
| **KaTeX** | HTML + hidden MathML | ~25 KB CSS + ~260 KB woff2 | fastest look-and-feel parity with LaTeX; fonts self-hosted from the katex package |
| **Temml** | native MathML | ~9 KB CSS + one math font | smallest markup by far, selectable text; we ship Latin Modern Math / STIX Two woff2 |
| **@webc.site/math** | native MathML | ~0 | minimum payload; thin TeX coverage, best for simple math |

Fonts are vendored from their canonical upstreams with licenses tracked in
[`src/fonts/`](src/fonts) and regenerated by [`scripts/fonts.py`](scripts/fonts.py)
(`uv run scripts/fonts.py`). See [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md) for adapted
code and test corpora credits.

## License

[MIT](LICENSE) © Divyansh Singh. Vendored fonts keep their own licenses
(GUST Font License, SIL OFL 1.1) — see [`src/fonts/MANIFEST.md`](src/fonts/MANIFEST.md).
