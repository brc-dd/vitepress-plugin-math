# Options

Everything on this page is accepted by `math()`, `withMath()` and `applyMath()` alike —
one option type, `ApplyMathOptions`. The two injection options are the only exception:
they configure the Vite plugin, so `applyMath()` ignores them.

| Option                                          | Default | |
| ----------------------------------------------- | ------- | --- |
| [`engine`](#engine)                             | auto    | which typesetting engine to use |
| [`mathjax`](#engine-options) · [`katex`](#engine-options) · [`temml`](#engine-options) | — | that engine's own options |
| [`delimiters`](#delimiters)                     | `'all'` | which TeX delimiters to parse |
| [`mathFence`](#mathfence)                       | `true`  | treat ` ```math ` fences as display math |
| [`inlineDisplay`](#inlinedisplay)               | `true`  | parse mid-paragraph `$$…$$` |
| [`allowInlineWithSpace`](#allowinlinewithspace) | `false` | allow `$ x $` |
| [`labels`](#labels)                             | `false` | parse `$$…$$ (label)` into an `id` anchor |
| [`vPre`](#vpre)                                 | `true`  | put `v-pre` on wrappers |
| [`copySource`](#copysource)                     | `true`  | put `data-tex` on wrappers |
| [`throwOnError`](#throwonerror)                 | `false` | fail instead of rendering an error placeholder |
| [`transformTex`](#transformtex)                 | —       | preprocess TeX before the engine sees it |
| [`inject`](#inject)                             | `true`  | wrap the theme entry with styles and client behavior |
| [`styles`](#styles)                             | `true`  | include the stylesheet imports in that wrapper |

## Choosing an engine

### `engine` {#engine}

- Type: `'mathjax' | 'katex' | 'temml' | 'webc' | MathRenderer`
- Default: auto-detected

Which engine turns TeX into HTML. A string names one of the four built-in adapters; an
object implementing [`MathRenderer`](/guide/advanced#custom-renderers) is used as-is.

Left out, the first installed engine wins in `ENGINE_PRIORITY` order — `mathjax` → `katex` →
`temml` → `webc` — and a build with none installed fails with the package to install. Naming
the engine explicitly is recommended for anything you deploy.

See [engines](/guide/engines) for what each one costs and covers.

### `mathjax`, `katex`, `temml` {#engine-options}

- Type: `MathJaxRendererOptions` · `KatexRendererOptions` · `TemmlRendererOptions`

The chosen engine's own option bag. `webc` takes no options.

```ts
math({ engine: 'mathjax', mathjax: { output: 'chtml' } })
```

Naming an `engine` narrows the type to that engine's bag, so editor completion offers
exactly the options that apply — and a bag for a different engine is a type error. With no
`engine`, any of the three may be passed.

The bag types are declared against the engine packages themselves. If your project turns
`skipLibCheck` off, the configured engine has to be installed for typechecking to pass.

Per-engine option tables live with each engine: [MathJax](/guide/engines#mathjax-options),
[KaTeX](/guide/engines#katex-options), [Temml](/guide/engines#temml-options).

## Parsing

### `delimiters` {#delimiters}

- Type: `'dollars' | 'brackets' | 'all'`
- Default: `'all'`

Which delimiter families are parsed.

- `'dollars'` — `$…$`, `$$…$$`, and the `` $`…`$ `` code-span form
- `'brackets'` — `\(…\)` and `\[…\]`
- `'all'` — both

Restricting this is the way to make one family literal: with `'brackets'`, dollars in prose
are never touched at all.

### `mathFence` {#mathfence}

- Type: `boolean`
- Default: `true`

Treat ` ```math ` fenced code blocks as display math. The fence's info string is matched on
its first word, so ` ```math {1} ` counts. Every other language is handed back to
VitePress's own fence renderer untouched.

Set it to `false` to render ` ```math ` blocks as highlighted source instead.

### `inlineDisplay` {#inlinedisplay}

- Type: `boolean`
- Default: `true`

Parse `$$…$$` (and `\[…\]`) appearing mid-paragraph as display math rendered inline — `a
$$x$$ b` works instead of falling back to literal text. The engine still renders in display
mode; only the wrapper changes to something inline-legal.

With `false`, mid-paragraph `$$` is left as text.

### `allowInlineWithSpace` {#allowinlinewithspace}

- Type: `boolean`
- Default: `false`

Allow inline math whose delimiters are padded with spaces (`$ x $`). Off by default,
matching KaTeX and Pandoc, because turning it on makes currency in prose much easier to hit
by accident.

### `labels` {#labels}

- Type: `boolean`
- Default: `false`

Parse a trailing `(name)` after a `$$` block's closing delimiter. The name becomes the
wrapper's `id`, which makes the equation deep-linkable, and reaches the renderer as
`ctx.label`.

```md
$$
a^2 + b^2 = c^2
$$ (pythagoras)
```

This is parser-level labelling, independent of the engine's own numbering. See
[syntax](/guide/syntax#equation-labels).

## Output

### `vPre` {#vpre}

- Type: `boolean`
- Default: `true`

Add `v-pre` to the wrapper elements. VitePress compiles markdown into Vue templates, so
without it a formula containing double curly braces would be read as an interpolation.
Required inside
VitePress; harmless anywhere else, and worth turning off when rendering plain HTML.

### `copySource` {#copysource}

- Type: `boolean`
- Default: `true`

Embed the original TeX in a `data-tex` attribute on the wrapper. This is what powers
[copy as TeX](/guide/copy-and-a11y) for every engine, and it survives render errors and
output modes that carry no annotations. Turning it off shrinks the HTML and disables the
copy behavior.

### `throwOnError` {#throwonerror}

- Type: `boolean`
- Default: `false`

By default, an expression the engine rejects becomes an inline placeholder —
`<span class="vpm vpm-inline vpm-error">` showing the delimited source, with the engine's
message in its `title` — and the build continues. Set this to `true` to rethrow instead, so
a bad formula fails the build.

This is about *expressions*. A missing or broken **engine** is a configuration failure and
always throws, whatever this is set to: a dev error overlay with the server alive, and a
failed `vitepress build`.

### `transformTex` {#transformtex}

- Type: `(tex: string, ctx: MathRenderContext) => string`

Preprocess the TeX source before the engine sees it.

```ts
math({
  engine: 'katex',
  transformTex: (tex, ctx) => (ctx.display ? `\\displaystyle ${tex}` : tex),
})
```

The context is the same one renderers get:

| Field     | |
| --------- | --- |
| `display` | `true` for display mode |
| `inline`  | `true` when display math sits mid-paragraph |
| `label`   | the `$$…$$ (label)` name, when [`labels`](#labels) is on |
| `env`     | markdown-it's `env` for the current page |

`data-tex` keeps the **original** source, so copy-as-TeX gives readers what they would type,
not what the engine saw.

## Injection

These two steer the Vite plugin. `applyMath()` ignores them.

### `inject` {#inject}

- Type: `boolean`
- Default: `true`

Serve the site's theme entry wrapped in a module that imports the engine's stylesheets and
starts the client composables — `useCopyTex()`, plus `useTemmlRefs()` under Temml. This is
what makes `math()` work with no theme file at all. The wrapper re-exports the real theme
unchanged, follows `extends` chains, and still runs a theme's own `setup()`.

::: warning
With `math()`, `inject: false` also removes the markdown wiring — the parser rules are
installed by the same plugin. Use `withMath(config, { inject: false })`, or install the
rules yourself with `applyMath`. See [manual wiring](/guide/advanced#manual-wiring).
:::

### `styles` {#styles}

- Type: `boolean`
- Default: `true`

Whether that wrapper also imports the engine's stylesheets. Turning it off keeps the client
composables and leaves the CSS to you — one import in your theme entry. The
[table of stylesheets](/guide/advanced#manual-wiring) says which one each engine needs.
