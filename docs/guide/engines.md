# Engines

The parser is engine-agnostic: it finds the TeX, an engine turns it into HTML. Four adapters
ship with the plugin, all as **optional peer dependencies** — nothing is bundled, and only
the engine you use is imported.

Pick one with the `engine` option:

```ts
math({ engine: 'katex' })
```

With no `engine`, the first installed one wins in the order `mathjax` → `katex` → `temml` →
`webc`. If none is installed, the build fails with the package to install.

## Choosing one

|                    | MathJax v4                          | KaTeX                        | Temml                       | @webc.site/math          |
| ------------------ | ----------------------------------- | ---------------------------- | --------------------------- | ------------------------ |
| **Output**         | SVG (default) or CHTML              | HTML + hidden MathML         | MathML                      | MathML                   |
| **Stylesheet**     | ~6 KB (SVG)                         | ~25 KB                       | ~9 KB                       | ~9 KB                    |
| **Markup size**    | large (SVG paths per expression)    | large                        | smallest by far             | smallest by far          |
| **Fonts**          | none in SVG mode; self-hosted webfonts in CHTML | from the `katex` package, woff2 only | one vendored math font, `local()` first | same as Temml |
| **Selection**      | assisted (SVG) / native (CHTML)     | native                       | native                      | native                   |
| **TeX coverage**   | broadest, incl. mhchem and physics  | broad, mhchem built in       | broad, most extensions built in | thin                 |
| **Numbering**      | AMS tags, `\label`/`\ref`           | `\tag` only                  | CSS counters + `\ref` via a composable | none          |

No engine ships JavaScript to the browser — every formula is typeset during the build. The
only client code is the ~1 KB copy helper, and it is the same for all four.

A short version:

- **KaTeX** if you want the LaTeX look, fast, with selectable text. This is the recommended
  default, and what this site uses.
- **MathJax** if you need the widest TeX coverage or line-breaking of long equations.
- **Temml** if you want real MathML and the smallest HTML.
- **@webc.site/math** if payload matters more than coverage and your math is simple.

Every engine gets the same wrapper contract, so [copy as TeX](/guide/copy-and-a11y), labels,
`v-pre` safety and keyboard-scrollable display math work identically across all four.

::: tip See them side by side
The [Examples](/examples/katex/){target="_self"} builds render the same pages with each
engine. They are separate builds stitched into the deployed site, so those links only work
there.
:::

## MathJax v4

```sh
pnpm add -D mathjax
```

```ts
math({ engine: 'mathjax', mathjax: { output: 'svg' } })
```

MathJax has the broadest TeX coverage of the four and is the only engine whose accessibility
story does not depend on the browser's MathML support. All of its async setup — component
loading, dynamic font data — happens once at config time, so rendering itself is synchronous
and the build stays deterministic.

**SVG output (the default)** is self-contained: `fontCache: 'local'` puts every glyph's path
data in the expression itself, so there are no webfonts at all and the stylesheet is a fixed
~6 KB. The trade-off is that SVG holds no selectable text, which is why the client adds an
[assisted selection layer](/guide/copy-and-a11y#assisted-selection) on top of it.

**CHTML output** renders selectable text and smaller markup, at the cost of webfonts and a
much larger stylesheet — the full static sheet (`adaptiveCSS: false`, which is what makes a
single site-wide CSS file possible) is around 1.6 MB raw before compression. The Vite plugin
serves and emits those fonts from your own deploy, including the extra font packages a
loaded extension pulls in.

### Options {#mathjax-options}

| Option           | Default              | |
| ---------------- | -------------------- | --- |
| `output`         | `'svg'`              | `'svg'` or `'chtml'` |
| `texPackages`    | see below            | TeX extensions to load, **replacing** the default list |
| `assistiveMml`   | `true`               | embed hidden MathML for screen readers |
| `stripLatexData` | `true`               | drop MathJax's per-node `data-latex` attributes (the wrapper's `data-tex` already carries the source) |
| `fontURL`        | `'/vpm-fonts/mathjax'` | URL prefix for CHTML webfonts; the default is what the Vite plugin serves |
| `mathjax`        | —                    | raw MathJax config, deep-merged last over the generated one |

The default TeX packages, on top of MathJax's own base set (base, ams, newcommand,
textmacros, noundefined, autoload, configmacros):

`amscd` · `bbox` · `boldsymbol` · `braket` · `bussproofs` · `cancel` · `cases` · `centernot`
· `color` · `colortbl` · `empheq` · `enclose` · `extpfeil` · `gensymb` · `mathtools` ·
`mhchem` · `physics` · `tagformat` · `textcomp` · `units` · `upgreek`

Four groups are deliberately left out: `html` (raw attribute injection from page content is
an XSS surface), `setoptions` (in-document TeX could rewrite parser config and break
per-page statelessness), the v2/v3 compatibility shims (`texhtml`, `colorv2`, `fontsizev3`),
and `bbm`/`bboldx`/`dsfont`, which need matching `@mathjax/*` font-extension packages
installed to render at all. The `\require` macro is removed for the same reason as
`setoptions`.

::: warning mhchem needs a font extension
`\ce` and `\pu` render through `@mathjax/mathjax-mhchem-font-extension`. When it is not
installed, mhchem is dropped from the defaults with a warning rather than failing the whole
startup — install it to get chemistry back:

```sh
pnpm add -D @mathjax/mathjax-mhchem-font-extension
```

:::

## KaTeX

```sh
pnpm add -D katex
```

```ts
math({ engine: 'katex' })
```

KaTeX is synchronous, stateless and fast, and its output is HTML with a hidden MathML layer
— so selection, find-in-page and screen readers all work without any help from us. Fonts
come from the `katex` package itself and are served from your own deploy.

The build strips KaTeX's woff and ttf fallback sources from the emitted stylesheet and drops
those files, which takes roughly 800 KB off a deploy. No browser in KaTeX's support range
fetches them; only the woff2 files remain.

KaTeX has no `\label`/`\ref` and no automatic equation numbering — `\tag` is the way to
number an equation. mhchem is loaded by default, so chemistry works out of the box:
$\ce{2H2 + O2 -> 2H2O}$.

### Options {#katex-options}

| Option   | Default | |
| -------- | ------- | --- |
| `katex`  | —       | forwarded to `katex.renderToString`, minus `displayMode` (set per expression). `throwOnError: false` is applied first |
| `mhchem` | `true`  | load the mhchem extension (`\ce`, `\pu`) at build time |

```ts
math({
  engine: 'katex',
  katex: { katex: { strict: 'ignore', macros: { '\\RR': '\\mathbb{R}' } } },
})
```

## Temml

```sh
pnpm add -D temml
```

```ts
math({ engine: 'temml' })
```

Temml emits MathML and nothing else. Its markup is by far the smallest of the four — around
a tenth of KaTeX's for the same expressions — and the browser does the layout, so the text
is real text: selectable, findable, and exposed to assistive technology directly.

Its built-in TeX coverage is the broadest of the light engines: mhchem, physics, braket,
mathtools, upgreek, cancel and texvc are all built in, with no extra imports. `\bbox` and
`\href` are not supported.

Equation numbering is a pure CSS counter, so it resets per page with no JavaScript.
`\ref`/`\eqref` are different: Temml renders those as empty anchors on the server and fills
them in client-side, so the plugin starts `useTemmlRefs()` for you whenever the engine is
Temml. That import is a 1 KB standalone module, not the full engine.

Two math fonts are vendored with the plugin, both unmodified upstream builds with their
licenses tracked in the repo:

- **Latin Modern Math** — the default, and the TeX look. Used by
  `vitepress-plugin-math/styles/temml.css`.
- **STIX Two Math** — preinstalled on macOS 13+, so most Apple readers resolve it locally
  and download nothing. Used by `vitepress-plugin-math/styles/temml-stix2.css`.

Both stylesheets declare `local()` first, so a reader who already has the font installed
never downloads it. To use the STIX variant, turn the automatic stylesheet off and import it
yourself — see [manual wiring](/guide/advanced#manual-wiring).

### Options {#temml-options}

| Option  | Default | |
| ------- | ------- | --- |
| `temml` | —       | forwarded to `temml.renderToString`, minus `displayMode`. `throwOnError: false` is applied first, and `macros` is re-created per page so `\gdef` cannot leak between pages |

## @webc.site/math

```sh
pnpm add -D @webc.site/math
```

```ts
math({ engine: 'webc' })
```

The minimum-payload option: a small TeX-to-MathML converter with no dependencies and no
options at all. It shares Temml's stylesheet and math font, since both produce MathML.

Its coverage is thin by design. `\binom`, `\color`, `\displaystyle`, physics and mhchem are
not supported, and anything it cannot parse becomes an
[error placeholder](/reference/options#throwonerror). It also emits legacy `mathvariant`
values that MathML Core ignores, so `\mathbb{R}` renders as a plain `R`. Use it when the
math on your site is simple and every kilobyte counts; otherwise Temml gives you real MathML
with none of these caveats.

`@webc.site/math` is MulanPSL-2.0 licensed, not MIT — see [credits](/about/credits).

## Custom engines

Anything that turns a TeX string into an HTML string can back this plugin. Pass an object
implementing `MathRenderer` as the `engine`:

```ts
math({
  engine: {
    name: 'my-engine',
    render: (tex, ctx) => renderSomehow(tex, ctx.display),
  },
})
```

`reset()`, `stylesheet()` and `finalize()` are optional hooks for per-page state, generated
CSS and build teardown. The full contract is in
[advanced usage](/guide/advanced#custom-renderers).

## Switching engines

Nothing in your markdown is engine-specific, so switching is a one-line change. What differs
is TeX coverage — an expression using `\physics` macros will render under MathJax and Temml
but not under KaTeX. The [examples app](https://github.com/brc-dd/vitepress-plugin-math/tree/main/examples/docs)
in the repo reads its engine from an environment variable for exactly this kind of
comparison.
