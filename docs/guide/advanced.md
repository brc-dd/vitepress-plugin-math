# Advanced usage

`math()` is meant to be the whole integration. Everything below is for the cases where you
want a piece of it on your own terms.

## Custom renderers {#custom-renderers}

Anything that turns a TeX string into an HTML string can be the engine. Pass an object
implementing `MathRenderer` as the `engine` option and it is used as-is — no package
resolution, no auto-detection.

```ts
import type { MathRenderer } from 'vitepress-plugin-math'

const renderer: MathRenderer = {
  name: 'my-engine',
  render(tex, ctx) {
    // ctx.display  — display mode
    // ctx.inline   — display math sitting mid-paragraph
    // ctx.label    — `$$…$$ (label)`, when `labels` is on
    // ctx.env      — markdown-it's env for the current page
    return typeset(tex, { display: ctx.display })
  },
  // Optional hooks:
  reset: () => resetEquationNumbers(), // per page — numbers, macros, labels
  stylesheet: () => generatedCss(), // CSS produced at runtime
  finalize: () => shutDown(), // build teardown
}
```

| Member         | Required | |
| -------------- | -------- | --- |
| `name`         | yes      | engine identifier, used in diagnostics and to pick the stylesheet |
| `render`       | yes      | synchronous; the returned HTML is embedded verbatim |
| `reset`        | no       | called once at the start of every markdown render, so pages stay independent under HMR |
| `stylesheet`   | no       | returns CSS for everything rendered so far; served as `virtual:vitepress-plugin-math.css` |
| `finalize`     | no       | called at the end of a build |

Two rules matter. `render` must be **synchronous** — do async setup in your factory before
handing the renderer over, the way the built-in adapters do. And a renderer **owns the
escaping of its own output**: the plugin inserts the string as-is, and the input is raw TeX
from the page.

A custom renderer gets `vitepress-plugin-math/styles/core.css` (the wrapper, overflow, focus
and error styles) and nothing else. Ship whatever else your engine needs yourself.

## Manual wiring {#manual-wiring}

Two options peel the automatic setup back.

**`styles: false`** keeps the theme wrapper and the client behavior, and drops only the
stylesheet imports. Import one yourself, in your theme entry:

```ts
// .vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme'
import 'vitepress-plugin-math/styles/katex.css'

export default DefaultTheme
```

| Engine            | Stylesheet to import                              |
| ----------------- | ------------------------------------------------- |
| KaTeX             | `vitepress-plugin-math/styles/katex.css`           |
| Temml, webc       | `vitepress-plugin-math/styles/temml.css`           |
| Temml (STIX Two)  | `vitepress-plugin-math/styles/temml-stix2.css`     |
| MathJax           | `virtual:vitepress-plugin-math.css`                |
| custom renderer   | `vitepress-plugin-math/styles/core.css`            |

The MathJax entry is a virtual module because that engine generates its CSS at render time.
For TypeScript to accept the import, add the ambient declaration to your tsconfig:

```json
{ "compilerOptions": { "types": ["vitepress-plugin-math/env"] } }
```

**`inject: false`** goes further: no theme wrapper at all, so the client composables are
yours to start as well.

```vue
<!-- .vitepress/theme/Layout.vue -->
<script setup>
import DefaultTheme from 'vitepress/theme'
import { useCopyTex, useTemmlRefs } from 'vitepress-plugin-math/client'

useCopyTex()
useTemmlRefs() // Temml only — resolves \ref/\eqref equation numbers
</script>

<template><DefaultTheme.Layout /></template>
```

Call them from a wrapping Layout component, not from `enhanceApp` — that runs during the SSR
build, where touching `document` breaks the build.

## Wiring markdown-it directly

`applyMath` is the parser half on its own: it resolves the engine and installs the rules on
a markdown-it instance. Inside VitePress that means the `markdown.config` hook, which is
awaited:

```ts
// .vitepress/config.ts
import { defineConfig } from 'vitepress'
import { applyMath } from 'vitepress-plugin-math'

export default defineConfig({
  markdown: {
    config: (md) => applyMath(md, { engine: 'temml' }),
  },
})
```

Styles, fonts and the client behavior are not part of this — add
[`mathStylesPlugin`](/reference/api#vite) and import a stylesheet yourself, or use `math()`
and stop worrying about it.

Outside VitePress, the low-level `mathPlugin` takes any markdown-it and any renderer:

```ts
import MarkdownIt from 'markdown-it'
import { mathPlugin } from 'vitepress-plugin-math'
import { createKatexRenderer } from 'vitepress-plugin-math/engines/katex'

const md = MarkdownIt()
mathPlugin(md, { renderer: await createKatexRenderer(), vPre: false })
```

`vPre: false` is worth setting outside VitePress — `v-pre` exists to keep Vue's template
compiler away from rendered math, and it is meaningless in plain HTML output.

## Deploying under a base path

Stylesheets and their font URLs are ordinary Vite assets, so KaTeX and Temml need nothing
from you: the URLs are hashed and rewritten with your `base` automatically.

MathJax **CHTML** is the exception. Its webfonts are served from an absolute path,
`/vpm-fonts/mathjax` by default, which does not know about your base. Under a sub-path
deploy, say it explicitly:

```ts
math({
  engine: 'mathjax',
  mathjax: { output: 'chtml', fontURL: '/my-repo/vpm-fonts/mathjax' },
})
```

MathJax's default SVG output has no webfonts at all, so this never comes up there.

## Webcontainers

Serving font binaries is the expensive part of a preview inside a webcontainer (StackBlitz
and friends), so VitePress has a `useWebFonts` option that defaults to a webcontainer probe.
When it is on, the plugin follows: MathJax's CHTML fonts and KaTeX's stylesheet come from
jsDelivr instead, each pinned to the exact installed version.

Everywhere else, nothing is fetched from a CDN. Temml stays self-hosted even in a
webcontainer — its font is vendored inside this package, so there is no CDN copy to point
at.

## Search indexing

VitePress's local search indexes the **rendered text** of a page. For math that means:

- The `data-tex` attribute is an attribute, so it never reaches the index.
- KaTeX and Temml embed a MathML `<annotation>` element holding the TeX source. Its text
  content is part of the rendered page, so raw LaTeX does end up in the index alongside the
  visible glyphs — searching for `\frac` can match a formula.
- MathJax SVG output has no text to index at all beyond the assistive MathML.

None of this breaks search; it just means math contributes noisy tokens. If that matters,
strip `annotation` elements in a search `_render` hook before the page is indexed.

## Preprocessing TeX

[`transformTex`](/reference/options#transformtex) sits between the parser and the engine,
which is the right place for site-wide macros or content fixes:

```ts
math({
  engine: 'katex',
  transformTex: (tex, ctx) => (ctx.display ? `\\displaystyle ${tex}` : tex),
})
```

The wrapper's `data-tex` keeps the **original** source, so copy-as-TeX still gives readers
what they would have to type, not what the engine saw.
