# API

Exports, by entry point. Most sites need exactly one of them — `math` from
`vitepress-plugin-math/vite`.

| Entry point                              | For |
| ---------------------------------------- | --- |
| [`/vite`](#vite)                         | the VitePress integration |
| [root](#root)                            | the markdown-it plugin and engine resolution |
| [`/client`](#client)                     | browser-side composables and helpers |
| [`/engines/*`](#engines)                 | the four engine adapters |
| [`/styles/*`](#styles)                   | stylesheets |
| [`/fonts/*`](#fonts)                     | vendored math fonts and their licenses |
| [`/env`](#env)                           | ambient types for the virtual stylesheet |

## `vitepress-plugin-math/vite` {#vite}

### `math(options?)`

```ts
function math(options?: ApplyMathOptions): VitePluginObject[]
```

The whole integration in one Vite plugin: parser rules, engine stylesheet, fonts, and the
client behavior. Also the default export of this entry point. Returns an array — Vite
flattens nested arrays in `plugins`, so it drops straight into `vite.plugins`.

```ts
import { defineConfig } from 'vitepress'
import { math } from 'vitepress-plugin-math/vite'

export default defineConfig({
  vite: { plugins: [math({ engine: 'katex' })] },
})
```

An engine that fails to resolve does not break config loading — the failure is rethrown the
first time a page renders math, so dev shows an error overlay and `vitepress build` fails.

### `withMath(config, options?)`

```ts
function withMath<T extends object>(config: T, options?: ApplyMathOptions): T
```

Compatibility path for a VitePress that reads `markdown` out of the user config once, before
Vite plugins run — see
[which VitePress works with `math()`](/guide/getting-started#which-vitepress-works-with-math).
Same wiring, except the markdown-it plugin is chained onto the config object directly.
Returns the same config object.

```ts
export default withMath(defineConfig({ /* … */ }), { engine: 'temml' })
```

### `mathStylesPlugin(renderer)`

```ts
function mathStylesPlugin(renderer: PromiseLike<MathRenderer> | MathRenderer): VitePluginObject[]
```

Just the styles half: serves the engine's generated stylesheet as
`virtual:vitepress-plugin-math.css`, self-hosts the MathJax CHTML webfonts (dev middleware
plus emitted build assets), and strips KaTeX's unused woff/ttf fallbacks from the build.

Part of what `math()` returns. Reach for it only when composing the pieces yourself — pass
it the same renderer (or promise of one) your markdown plugin uses.

### `MATH_STYLES_ID` {#math-styles-id}

```ts
const MATH_STYLES_ID = 'virtual:vitepress-plugin-math.css'
```

The importable id of the engine-generated stylesheet. The Vite plugin imports it for you
under MathJax; you need it only under `inject: false` or `styles: false`.

## `vitepress-plugin-math` {#root}

### `applyMath(md, options?)`

```ts
function applyMath(md: MathMarkdownIt, options?: ApplyMathOptions): Promise<MathRenderer>
```

Resolves the engine, then installs the markdown-it plugin. Returns the resolved renderer,
whose `stylesheet()` and `finalize()` are useful for custom integrations. Async, so it
belongs in VitePress's awaited `markdown.config` hook — see
[wiring markdown-it directly](/guide/advanced#wiring-markdown-it-directly).

### `resolveRenderer(options?)`

```ts
function resolveRenderer(options?: ApplyMathOptions): Promise<MathRenderer>
```

Engine resolution on its own. An explicit `MathRenderer` is returned as-is; a named engine
is loaded (throwing `EngineMissingError` when its package is absent, and a name-listing error
when the name is unknown); with no `engine`, the first installed one wins in
`ENGINE_PRIORITY` order.

### `mathPlugin(md, options)`

```ts
function mathPlugin(md: MathMarkdownIt, options: MathPluginOptions): void
```

The engine-agnostic markdown-it plugin: registers the TeX rules and delegates rendering to
`options.renderer`, which is **required** here. Synchronous — do the engine setup first.
`MathPluginOptions` is [`MathOptions`](/reference/options) plus `renderer`.

### `ENGINE_PRIORITY`

```ts
const ENGINE_PRIORITY: readonly MathEngineName[] // ['mathjax', 'katex', 'temml', 'webc']
```

The auto-detection order used when no `engine` is configured.

### `EngineMissingError`

Thrown when an engine's optional peer package is not installed. Carries `engine` (the name)
and `specifier` (the package to install) alongside a message that already spells out the
install command.

### Types

`ApplyMathOptions` · `MathEngineName` · `MathOptions` · `MathPluginOptions` ·
`MathRenderer` · `MathRenderContext` · `MathDelimiters` · `MathEnv`

`MathRenderer` is the [custom-engine contract](/guide/advanced#custom-renderers);
`MathRenderContext` is what `render` and [`transformTex`](/reference/options#transformtex)
receive.

## `vitepress-plugin-math/client` {#client}

SSR-safe — no browser globals at import time. The composables belong in a wrapping Layout
component's `<script setup>`, or in a theme's `setup()`; the Vite plugin calls them for you
unless you set [`inject: false`](/reference/options#inject).

### `useCopyTex(options?)`

```ts
function useCopyTex(options?: UseCopyTexOptions): void
```

Installs the delegated `copy`/`cut` listeners so selections containing math copy the original
TeX, plus the assisted-selection layer for SVG-rendered math. Listeners go on `document` in
`onMounted`, so they survive SPA navigation without re-initialization.

`UseCopyTexOptions` extends `CopyTexOptions` with:

| Option             | Default | |
| ------------------ | ------- | --- |
| `selectOnDblclick` | `true`  | assisted selection for math with no selectable text (MathJax SVG) — double-click to select, double-tap or long-press for a "Copy TeX" chip. Engines rendering selectable DOM are never affected |

`CopyTexOptions`:

| Option          | Default                | |
| --------------- | ---------------------- | --- |
| `delimiters`    | `$…$` / `$$…$$`        | `{ inline: [open, close], display: [open, close] }` |
| `roots`         | see below              | selectors identifying a math root, probed one at a time, outermost first |
| `container`     | —                      | `() => ParentNode \| null`, to restrict handling to one subtree |
| `blockNewlines` | `true`                 | pad display math with newlines so it keeps its block boundaries |
| `fallbackRoot`  | the marked formula     | `() => Element \| null`, the formula to copy when there is no usable selection |

The default roots are `[data-tex]`, `.katex-display`, `.katex`, `mjx-container`, `math` — our
own wrapper first, then engine-native markup, so the helpers also work on math this plugin
did not render.

### `useTemmlRefs()`

```ts
function useTemmlRefs(): void
```

Resolves Temml's `\ref`/`\eqref` cross-references, which Temml renders as empty anchors on
the server. Imports Temml's 1 KB standalone post-processor — not the full engine — and
re-runs on every content update. Only needed with Temml, and only when pages use those
macros. The Vite plugin calls it automatically under that engine.

### Lower-level helpers

```ts
function createCopyTexHandler(options?: CopyTexOptions): (event: ClipboardEvent) => void
function createDblclickSelectHandler(options?: CopyTexOptions): DblclickSelectHandle
function texOf(root: Element): string | null
function isDisplayMath(root: Element): boolean
function replaceMathWithTex(fragment: DocumentFragment, options?: CopyTexOptions): DocumentFragment
```

The pieces the composables are built from, for wiring the behavior into something other than
a Vue component. `texOf` reads the wrapper's `data-tex`, falling back to a MathML
`annotation` and then MathJax's `data-latex`. `DblclickSelectHandle` exposes one handler per
event to attach, plus `getMarked()` and `clear()`.

Types: `CopyTexOptions` · `CopyTexDelimiters` · `UseCopyTexOptions`.

## `vitepress-plugin-math/engines/*` {#engines}

One module per adapter. Each factory does its async setup up front and returns a renderer
whose `render` is synchronous.

```ts
import { createKatexRenderer } from 'vitepress-plugin-math/engines/katex'

const renderer = await createKatexRenderer({ mhchem: false })
```

| Module     | Exports |
| ---------- | ------- |
| `/engines/mathjax` | `createMathJaxRenderer(options?)`, `MathJaxRendererOptions`, `DEFAULT_TEX_PACKAGES`, `MATHJAX_FONT_URL` |
| `/engines/katex`   | `createKatexRenderer(options?)`, `KatexRendererOptions` |
| `/engines/temml`   | `createTemmlRenderer(options?)`, `TemmlRendererOptions` |
| `/engines/webc`    | `createWebcMathRenderer()` |

The option types are the same ones the [per-engine bags](/reference/options#engine-options)
take. `vitepress-plugin-math/engines/shared` also resolves under this subpath — it holds the
error types and loader plumbing the adapters share, and `EngineMissingError` is re-exported
from the [root entry](#root) for catching.

## `vitepress-plugin-math/styles/*` {#styles}

| File               | For |
| ------------------ | --- |
| `core.css`         | the plugin's own wrappers — overflow, focus, selection mark, error styling. Imported by the others |
| `katex.css`        | KaTeX: the upstream stylesheet plus fixes |
| `temml.css`        | Temml or webc, with Latin Modern Math |
| `temml-stix2.css`  | Temml or webc, with STIX Two Math |

Import one only under [`styles: false`](/reference/options#styles) or `inject: false`;
otherwise the Vite plugin picks the right one. MathJax has no file here — its CSS is
generated at render time and served as [`MATH_STYLES_ID`](#math-styles-id).

## `vitepress-plugin-math/fonts/*` {#fonts}

The vendored math fonts and their paperwork: `latin-modern-math.woff2`,
`stix-two-math.woff2`, `GUST-FONT-LICENSE.txt`, `OFL-STIXTwoMath.txt` and `MANIFEST.md`. The
Temml stylesheets reference them; you need this subpath only when writing your own CSS.
Provenance and licensing are summarized in [credits](/about/credits).

## `vitepress-plugin-math/env` {#env}

Ambient declaration for the `virtual:vitepress-plugin-math.css` module, so TypeScript accepts
the import when you wire MathJax's stylesheet by hand:

```json
{ "compilerOptions": { "types": ["vitepress-plugin-math/env"] } }
```
