# Getting started

## Install

Install the plugin and one typesetting engine. KaTeX is the recommended starting point —
it is fast, its output is selectable text, and its fonts come straight from the `katex`
package.

::: code-group

```sh [pnpm]
pnpm add -D vitepress-plugin-math katex
```

```sh [npm]
npm add -D vitepress-plugin-math katex
```

```sh [yarn]
yarn add -D vitepress-plugin-math katex
```

```sh [bun]
bun add -d vitepress-plugin-math katex
```

:::

Swap `katex` for `mathjax`, `temml`, or `@webc.site/math` if you want a different engine —
they are all optional peer dependencies, imported only when used. The
[engines guide](/guide/engines) compares them; you can also install several and switch with
one option.

With no `engine` option, the first installed engine wins in this order:

`mathjax` → `katex` → `temml` → `webc`

That is descending payload and descending TeX coverage: MathJax renders the most TeX,
`@webc.site/math` ships the least JavaScript. Auto-detection is convenient, but naming the
engine explicitly is better for a real site — then installing another engine for a
comparison cannot silently change your output.

## Configure

One entry in `vite.plugins`, and nothing else:

```ts
// .vitepress/config.ts
import { defineConfig } from 'vitepress'
import { math } from 'vitepress-plugin-math/vite'

export default defineConfig({
  vite: { plugins: [math({ engine: 'katex' })] },
})
```

## Write math

That is it — `$…$` and `$$…$$` now work in every page:

```md
Euler's identity, $e^{i\pi} + 1 = 0$, in the middle of a sentence.

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$
```

Euler's identity, $e^{i\pi} + 1 = 0$, in the middle of a sentence.

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

`\(…\)` / `\[…\]`, ` ```math ` fences and GitHub's `` $`x+y`$ `` form work too. See the
[syntax guide](/guide/syntax) for all of them.

## What you get out of the box

`math()` is the whole integration. It:

- **registers the parser rules** on VitePress's markdown-it instance — all delimiters,
  math fences, currency and escape handling;
- **imports the engine's stylesheet** by serving your theme entry wrapped in a small module
  that adds the right CSS for the engine you chose (your own theme, or the default one when
  you have no theme file);
- **serves and emits the fonts** the engine needs from your own deploy — no CDN;
- **starts the client behavior** from that same wrapper: `useCopyTex()` so copying a formula
  yields its TeX, plus `useTemmlRefs()` when the engine is Temml.

There is no `markdown.config` hook to write, no theme file to create, and no stylesheet to
import. If you would rather wire some of that yourself, `inject: false` and `styles: false`
hand the pieces back — see [advanced usage](/guide/advanced).

Themes are left intact: a theme's own `setup()` still runs, and `extends` chains are
followed, so `math()` composes with theme packages instead of replacing them.

## Which VitePress works with `math()`

`math()` hangs the markdown rules off VitePress's **resolved site config**, which requires a
VitePress that reads its markdown options from there rather than capturing them once, up
front ([vuejs/vitepress#5405](https://github.com/vuejs/vitepress/pull/5405)).

On a VitePress without that fix — including `2.0.0-alpha.19` — use `withMath()` instead. It
wraps your config object and chains the markdown hook onto it directly, and is otherwise
identical: same styles, same fonts, same client behavior, still no theme file.

```ts
// .vitepress/config.ts
import { defineConfig } from 'vitepress'
import { withMath } from 'vitepress-plugin-math/vite'

export default withMath(
  defineConfig({
    // your config
  }),
  { engine: 'katex' },
)
```

Both take exactly the same [options](/reference/options). Prefer `math()` when your
VitePress supports it: it is one plugin in an array, and it composes with other plugins
instead of wrapping the whole config.

::: tip
This site runs `math()` on a patched `2.0.0-alpha.19` — the patch is that one-line upstream
fix, and it lives in the repo under `patches/`.
:::

## When something is missing

If no engine is installed, the build fails with the package to install rather than quietly
rendering nothing. In dev the same failure arrives as an error overlay and the server stays
up, so installing the engine and reloading is enough.

A formula the engine cannot render is a different case: it becomes an inline error
placeholder (`<span class="vpm-error">`) carrying the message in its `title`, and the build
continues. Set [`throwOnError`](/reference/options#throwonerror) to fail the build instead.

## Where next

- [Syntax](/guide/syntax) — every delimiter, with live examples.
- [Engines](/guide/engines) — what each engine costs and what it can render.
- [Copy and accessibility](/guide/copy-and-a11y) — how selection, copy and screen readers
  behave.
- [Options](/reference/options) — the full option list.
