# Architecture

How the plugin is built, and why. This is the reasoning behind the behavior documented in
the [guide](/guide/getting-started) — useful if you are extending the plugin, debugging
something odd, or deciding whether to trust it with your content.

## The parser

The plugin owns its markdown-it rules. It does not wrap an existing math plugin.

Two reasons. The ecosystem's best parser, `@mdit/plugin-tex`, peers markdown-it v15 only,
while VitePress hands out a bundled v14 instance. And the defects below are structural
enough that fixing them from the outside is not possible.

### What it inherits

The scanning approach is well-established and worth keeping. Delimiters are matched by
character code with no regular expressions in the hot path. `$` rules register after
markdown-it's `escape` rule; `\(` and `\[` rules must register *before* it, because `(` and
`[` are in the escape set and would otherwise be eaten first. Closing scans are clamped to
the current inline scope, so a closer can never be found across a link label. A word-boundary
test on the opening `$` kills currency false positives. Delimiter pairs are tried
longest-first, so `$$` beats `$` with no special-casing.

Silent mode gets strict discipline in both directions. Inline silent calls come from link
label probing, where the scope is not yet narrowed, so the rules decline rather than scan
forward. Block silent calls come from paragraph interruption, and answer without touching
any state.

### What it fixes

Each of these is a real defect in one or more of the widely used plugins:

- **Mid-paragraph display math** (`a $$x$$ b`) rendered as literal text. Here it emits a
  display-mode token with an inline-legal wrapper. It is never a `<p>` inside a `<p>`, which
  is how one popular fork does it — and which breaks Vue SFC compilation outright.
- **Trailing punctuation after a block closer** was swallowed into the TeX, so `$$…$$.` fed
  the engine a stray period.
- **The four-space code-block guard** was missing on the closing line, leaving stray empty
  math blocks after indented code.
- **` ```math {1} ` fences** were not recognized, because the info string was matched
  exactly. VitePress users write line-highlight attributes there constantly.
- **Lazy blockquote continuation** produced a spurious empty block.
- **Image alt text** dropped the math entirely. Here it survives as its original delimited
  source.
- **Equation labels** did not exist.
- **Blank lines inside `$$`** were allowed, which means one unclosed `$$` swallows the rest
  of the document. Here a blank line ends the search for a closer.
- **The word-boundary test was ASCII-only**, so accented and CJK text behaved as
  punctuation. Here Latin, Greek and Cyrillic letters bind to a `$`, while CJK and other
  space-less scripts do not — those scripts never put a space before an inline formula.

One thing is not fixable at this layer. Table rows are split on unescaped `|` before inline
parsing runs, so a pipe inside math has to be written `\|`. Inline code spans have the same
limitation for the same reason.

## The wrapper contract

Engines emit their own markup. The plugin wraps it in an element of its own, and that
wrapper is what the rest of the system is built on.

| | |
| --- | --- |
| `class` | `vpm vpm-inline`, or `vpm vpm-display` — plus `vpm-display-inline` for display math mid-paragraph, and `vpm-error` on a failed render |
| `v-pre` | present unless [`vPre`](/reference/options#vpre) is off |
| `data-tex` | the original TeX source, before any `transformTex` |
| `data-display` | `"true"` on display math |
| `tabindex` | `"0"` on block display math |
| `id` | the `$$…$$ (label)` name, when labels are on |

`v-pre` is not optional inside VitePress. Markdown compiles into Vue SFC templates, so a
formula containing double curly braces would otherwise be read as an interpolation. It is
emitted
as part of the wrapper rather than patched in afterwards.

The element is a `<div>` for block display math and a `<span>` everywhere else. Block tokens
are never inside a `<p>`, so a `div` is legal there and gives us horizontal scrolling and a
focusable box. Mid-paragraph display math sits inside a paragraph and must stay inline-legal,
so it gets a `span` styled `inline-block`.

`data-tex` is the piece that makes everything else engine-independent. It survives render
errors, output modes with no MathML, and MathJax v4, which has no MathML output jax at all.
Copy-as-TeX, the assisted selection layer and any "view source" feature built later all read
that one attribute — never a serialized-HTML regex.

The emitted markup never contains `<style>` tags: Vue strips them from client component
templates. And the plugin's CSS is deliberately unlayered, so it wins over VitePress's theme
styles, which all live in a cascade layer.

## Engine lifecycle

markdown-it has no asynchronous renderer rules. Every adapter therefore does all of its async
work in its factory — component loading, dynamic font data, extension imports — and returns a
renderer whose `render` is synchronous. VitePress awaits the `markdown.config` hook, so that
setup has a place to happen.

Engines are optional peer dependencies, loaded by dynamic import. Only "this exact package is
not installed" maps to the install hint; a crash inside an engine, or a broken transitive
dependency, is rethrown as-is rather than misreported as a missing package.

**Per-page state is reset on every render.** A core rule runs at the end of the parse, before
any renderer rule fires, and calls the engine's `reset()`. AMS equation numbers, `\gdef`
macros and label registries all start fresh, so pages are independent and HMR cannot
accumulate state across edits.

**Failures are separated by kind.** A single expression the engine rejects becomes an error
placeholder carrying the message in its `title`, and the build continues — unless
[`throwOnError`](/reference/options#throwonerror) says otherwise. A missing or broken engine
is a site-level configuration failure and always throws. It cannot throw during config
loading, though: VitePress builds its dev server there, and a throw would take the process
down on a config reload. Instead the rules register with a stand-in renderer that rethrows on
first use, which surfaces as a dev error overlay with the server alive, and as a failed
`vitepress build`.

**MathJax gets special handling.** One process holds one MathJax instance, because `init()`
merges into the previous config and quietly keeps the first output format. A renderer created
later with different options reconfigures that instance in place — loading new components,
swapping config blocks, and rebuilding the input and output jax. That is what lets a dev
server pick up a new `output` or `texPackages` from a config reload without a restart.

MathJax output is also pinned to be deterministic: the SVG glyph-id namespace is fixed rather
than derived from a process-global counter, and the font caches are cleared per page. The
same input produces byte-identical output across pages and rebuilds, which is what content
hashing needs.

## Styles and fonts

Nothing is fetched from a CDN. The engine's stylesheet and every font it needs are served
from the site's own deploy.

The one exception is VitePress's `useWebFonts`, which defaults to on inside a webcontainer,
where shipping font binaries is the expensive part of a preview. There, MathJax's CHTML fonts
and KaTeX's stylesheet come from jsDelivr, each pinned to the exact installed version. Temml
stays self-hosted even then: its font is vendored in this package, so there is no CDN copy to
point at.

Two build-time optimizations come for free. KaTeX's woff and ttf fallback sources are
stripped from the emitted stylesheet and the orphaned files dropped, which is around 800 KB
per deploy that no browser would ever fetch. MathJax CHTML fonts are emitted under
`/vpm-fonts/mathjax/<package>`, one directory per font package, so a page that loads a font
extension gets its files too — the stylesheet is read back to find out which packages are
actually in play.

### Font licensing

Vendored fonts are the **unmodified upstream fonts**. Latin Modern Math is converted from OTF
to WOFF2 and nothing else; the conversion asserts that glyphs, metrics, `name` records, cmap
coverage and the MATH table are identical to the source. STIX Two Math is copied byte for
byte from upstream's own WOFF2 build.

That is a deliberate choice, not laziness about subsetting. Subsetting a math font barely
pays: MathML Core's user-agent stylesheet maps every single-character `<mi>` into the
Mathematical Alphanumeric Symbols block, so that whole plane is mandatory. And a glyph subset
is a modification, which brings Reserved Font Name obligations that a pure format conversion
does not.

Licenses and provenance live beside the fonts, with the GUST change notice the license asks
for and the full license texts. Fonts are regenerated by a script, never edited by hand. See
[credits](/about/credits) for the summary.

The stylesheets name their font family explicitly and put `local()` first. Explicitly,
because the CSS `math` generic cannot see author `@font-face` rules in Gecko or Chromium —
only WebKit recurses into them. `local()` first, because a reader who already has the font
installed should never download it.

All plugin CSS beyond what the engines provide is written against VitePress's own theme
variables. There is no bespoke palette, and a custom theme that redefines those variables
gets math that follows it.

## The client

The browser-side code is small and deliberately not borrowed from any engine. Upstream
copy-tex extensions mutate the live selection, probe root selectors in a way that leaks the
visual layer into the clipboard, and concatenate display math onto the preceding paragraph.

One delegated `copy` listener goes on `document`, installed in `onMounted`, so it survives
SPA navigation without re-initialization. When a selection contains math, the range is
**cloned** before anything is expanded, partial selections grow to whole formulas, and each
math root in the copied fragment is replaced with its delimited TeX. Both `text/plain` and
`text/html` flavors are set.

The assisted selection layer applies only to output with no selectable text, which today
means MathJax's SVG. Everything else keeps its native gestures untouched. Detection is by
what is actually in the DOM, not by which engine is configured.

`useTemmlRefs()` exists because Temml renders `\ref`/`\eqref` as empty anchors on the server
and fills them client-side. It imports the 1 KB standalone post-processor, not the 115 KB
engine entry.

Both composables are started from the theme wrapper the Vite plugin serves, in `setup()` —
the one hook VitePress calls from inside its root component. `enhanceApp` runs during the SSR
build, where touching `document` is fatal.

## VitePress integration

The plugin leans on a handful of specific VitePress behaviors:

- `markdown.config` is awaited, which is what makes async engine setup possible.
- The `markdown` options are read from the resolved site config, which is what lets a Vite
  plugin install parser rules at all
  ([vuejs/vitepress#5405](https://github.com/vuejs/vitepress/pull/5405)). `withMath()` exists
  for versions without that.
- Shared renderer rules are always chained, never replaced — the fence rule captures
  VitePress's Shiki renderer and delegates every non-math language back to it.
- The theme wrapper re-exports the real theme unchanged, follows `extends` chains, and calls
  a theme's own inherited `setup()` before starting the composables.
