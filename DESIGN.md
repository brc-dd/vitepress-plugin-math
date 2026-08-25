# Design Notes

Working notes for `vitepress-plugin-math`. Distilled from research against
vitepress `2.0.0-alpha.19` (`vuejs/vitepress@110209dd`), current engine sources,
and the markdown-it plugin ecosystem.

## Why this exists

VitePress's built-in `math: true` delegates to `markdown-it-mathjax3@^4`
(`src/node/markdown/markdown.ts:506-529`), which is a stopgap the maintainer
already plans to replace (vuejs/vitepress#5345 TODO: "replace mathjax plugin
with something from mdit-plugins"). Its architecture is the root of the loudest
open math bugs:

- MathJax **3** (not 4), SVG output with `fontCache: 'none'` — every glyph's
  path data inlined per equation; enormous HTML.
- A fresh `liteAdaptor()` + `RegisterHTMLHandler` + `mathjax.document()` per
  equation — global handler state mutated per render (OOM/leak reports:
  vuejs/vitepress#4415, #4833).
- `juice` inlines the stylesheet per element — no theming, no dark mode by
  design, and `juice@8.0.0` lowercases `viewBox` (vuejs/vitepress#5394).
- No instance access → `\label`/AMS `tags` state never resets across renders
  and HMR (vuejs/vitepress#4740).
- Hardcoded `$`/`$$` delimiters only.
- `math?: any | boolean` — untyped options.

Nobody has ever filed a Temml/MathML request against vitepress — uncontested
niche, and the only route to selectable, accessible math text.

## Package API (plan)

`vitepress-plugin-math`, exports:

- `.` (node): `applyMath(md, options?)` — async: resolves the engine
  (explicit `renderer`, named `engine`, or auto-priority
  mathjax→katex→temml→webc), then installs parser + renderer rules
  synchronously. Low-level pieces also exported: `mathPlugin(md,
  { renderer, ... })` (sync, engine-agnostic, `renderer` required),
  `createMathJaxRenderer` / `createKatexRenderer` / `createTemmlRenderer` /
  `createWebcMathRenderer` factories, `resolveRenderer`.
- `./client`: `useCopyTex()`, `useTemmlRefs()` composables + low-level
  copy-tex functions.
- `./styles/*`: `core.css` (wrapper/overflow/focus + vp-var alignment),
  engine style entries (katex via upstream import + our fixes; temml CSS +
  vendored fonts; mathjax handled by vite plugin virtual CSS).
- `./vite`: `mathVitePlugin()` — serves/emits engine CSS+fonts (needed for
  MathJax CHTML: virtual stylesheet generated at init + woff2 assets from
  `@mathjax/mathjax-*-font`, dev middleware + build emitFile, never CDN).
- Renderer contract (superset of @mdit/plugin-tex's, carries labels):

  ```ts
  interface MathRenderer {
    render(tex: string, ctx: { display: boolean; env: unknown }): string
    // optional: css/head assets, per-page reset, client hints
    reset?(): void            // called per page/render root (AMS labels …)
    stylesheet?(): string     // engine CSS (MathJax adaptive/static)
    finalize?(): Promise<void> | void  // build end (MathJax.done)
  }
  ```

  Output wrapping (ours, not the engine's): `v-pre` + `data-tex` live on
  OUR wrapper (Vue safety + engine-independent copy source).
  - `math_inline` → `<span class="vpm vpm-inline" v-pre data-tex="…">`
  - `math_block` → `<div class="vpm vpm-display" v-pre tabindex="0"
    data-tex="…">` (block tokens are never inside `<p>`, so `<div>` is
    legal and gives us overflow-x scrolling)
  - inline display math (`a $$x$$ b`) → `<span class="vpm vpm-display
    vpm-display-inline" …>` — must stay inline-legal HTML since it sits
    inside a paragraph.

## Architecture

Single package `vitepress-plugin-math` with:

- **Core parser**: our own markdown-it inline + block TeX rules (no dependency
  on `@mdit/plugin-tex`), engine-agnostic. Emits `math_inline` / `math_block`
  tokens; rendering is delegated to a pluggable renderer.
- **Renderer contract**: a small interface any engine can implement
  (user-extensible). Built-in adapters for `mathjax` (v4), `katex`, `temml`,
  `@webc.site/math` — all **optional peer deps**, dynamically imported.
- **Default engine selection by priority**: mathjax → katex → temml →
  `@webc.site/math`, first one installed wins; explicit override always
  possible.
- **Styles/fonts**: import CSS from the engine npm packages themselves where
  possible (Vite resolves the relative font URLs); no CDN. Subset fonts in-repo
  with scripts where the upstream package ships oversized fonts.

## VitePress integration facts (verified against vp 2.0.0-alpha.19)

- Hook: `markdown: { config: (md) => ... }` — awaited, so **async setup** is
  fine (init engines once, up front). But `markdown-it-async`'s async support
  is *only* for `highlight` (placeholder map + `renderAsync`); there is **no
  generic async renderer-rule hook**. So: async engine init in the plugin
  factory, **sync `render()` at token time**. (KaTeX/Temml are sync; MathJax
  v4 must be pre-initialized.) `preConfig` exists if we must claim delimiters
  before built-ins. v1's hooks are sync `(md) => void` — if we support
  vitepress 1, engine init must happen before `config` runs (factory returns
  a promise the user awaits, or top-level await in their config).
- markdown-it is **v14.3.0** (bundled into vitepress's dist; we get handed the
  live `md` instance so no version-matching issue). v15 bump tracked in #5345 —
  target v14, stay v15-ready.
- **`v-pre` is non-negotiable**: markdown compiles to Vue SFC templates; raw
  math HTML must be wrapped in an element carrying `v-pre` or `{{ }}` gets
  interpreted (vuejs/vitepress#229, #529). Emit our own wrapper with `v-pre`
  already present — no post-hoc string replace.
- Block math gets `tabindex="0"` + `overflow-x: auto` (a11y precedent from
  #3914/#3932); inline math needs an inline box (#3567).
- Never assign shared renderer rules (e.g. `table_open`) without chaining
  (#4239 regression precedent).
- No `<style>` tags in emitted markup — Vue strips them in client component
  templates (#5015 is why vitepress pins `markdown-it-mathjax3@^4`).
- Theme CSS all lives in `@layer __vitepress_base` — our **unlayered** CSS wins
  the cascade automatically; don't put ours in that layer.
- CSS shipping routes: (1) user imports `vitepress-plugin-math/…/style.css` in
  their theme entry (documented, zero-magic), (2) a Vite plugin merged via the
  `vite` config that auto-injects the import (maintainer's own virtual-module
  pattern from #4740). Prefer documenting (1) and offering (2).
- Fonts: mirror vitepress's `theme` / `theme-without-fonts` split — offer
  fonts-included and fonts-excluded style entries. VitePress subsets its own
  fonts via an in-repo script (`705c1be0`) — same approach here.
- `postcssIsolateStyles` is a public vitepress export if we want `.vp-raw`
  opt-out semantics for our CSS.
- Renders must be **stateless per page**: reset AMS label/tag state between
  renders (fixes the #4740 class of bugs under HMR).
- `restoreEntities` plugin runs before `preConfig` and rewrites `text_special`
  handling — relevant to `\` handling around math delimiters.
- Vue no longer sets `isCustomElement` (removed in `c9b89282`); users can via
  the `vue` option, but `v-pre` makes it unnecessary.

## Precedents for the optional-peer pattern

VitePress itself: `peerDependencies: { "markdown-it-mathjax3": "^4" }` +
`peerDependenciesMeta: { optional: true }` + dynamic `import()` + a clear
install-hint error. Copy that shape for all four engines (but don't swallow
real errors in the catch — vitepress's version misreports plugin crashes as
"not installed").

## Parser design (from ecosystem research, verified 2026-08)

Lineage: `markdown-it-math` (2015) → `markdown-it-katex` (Flinn) → forks
(`@vscode/markdown-it-katex`, `markdown-it-mathjax3`, `@mdit/plugin-tex`).
`@mdit/plugin-tex@1.1.0` is best-in-class but peers markdown-it **v15** only
(1.0.2 was the last v14 release) — another reason to own the parser.

### Keep from `@mdit/plugin-tex` (it gets these right)

- charCode-only comparisons, zero regex in hot paths. `$` and `\` are both
  `text`-rule terminator chars, so `$`-keyed rules are cheap by construction.
- Register `$` rules `after('escape')`; register `\(`/`\[` rules
  **`before('escape')`** ( `(`/`[` are in ESCAPED — escape eats them first
  otherwise). Opening `$` is escape-safe by construction at either position;
  the **closing** scan needs the backslash-parity loop.
- Clamp all closing-delimiter `indexOf` scans to `state.posMax` (prevents
  crossing link-label boundaries).
- Word-boundary opener test kills currency false-positives (`$5 and $10`).
- Block rule at `after('blockquote')` with
  `alt: ["paragraph","reference","blockquote","list"]`.
- Inline `silent` = link-label probing: guard every `state.pending`/token
  mutation with `if (!silent)`. Block `silent` = paragraph-interrupt probe:
  answer after the opener check, before the closer search, no side effects.
- `md.utils.isWhiteSpace` (Unicode-aware) for whitespace-back scans.
- Whitespace-surrounded `$` inside math is a literal `$` (`$\text{a $ b}$`)
  — but only when both sides are space, else it may open a new expression.

### Fix (confirmed defects in `@mdit/plugin-tex@1.1.0` — our differentiators)

1. No inline display math: `a $$x$$ b` renders literally. We emit a
   display-mode *inline* token rendered as inline-legal HTML (never a `<p>`
   inside a `<p>` like @vscode's, which breaks Vue SFC compilation).
2. Trailing punctuation after block closer swallowed: `$$\na=1\n$$.` puts
   `$$.` into the TeX content.
3. Missing `sCount - blkIndent >= 4` code-block guard (opening AND closing
   line — `markdown-it-math` v6 guards the closer too) → stray empty
   `math_block` after indented code.
4. ` ```math {1} ` fence not recognized (exact-match on `info`; match the
   first word instead — vitepress users use `{1}` line-highlight attrs).
5. Lazy blockquote continuation emits a spurious empty block.
6. Math dropped from image alt (`renderInlineAsText` only knows
   text/image/code_inline/softbreak — set `content` on tokens or add a rule).
7. No `$$…$$ (label)` equation-label support (texmath/dollarmath have it;
   ties into vitepress#4740 AMS-label pain).
8. Blank lines allowed inside `$$` → unclosed block swallows the document
   (dollarmath forbids; forbid, matching it).
9. ASCII-only word-boundary test (CJK/accented chars behave as punctuation)
   — decide Unicode policy deliberately.

Also from `markdown-it-math` v6: generic delimiter-pair table **sorted
longest-first** so `$$` beats `$` with no special-casing; custom renderers
escape by default (security: content is raw TeX — engines escape, but custom
renderers must own escaping; default-escape in any fallback path).

### markdown-it mechanics (verified on 14.3.0 and 15.0.0)

- `$` (0x24) and `\` (0x5C) are `text`-rule terminators; `|` is not. A
  `$`-keyed rule costs nothing at non-`$` positions and needs no early chain
  placement.
- Measured: for `$` rules, `before('escape')` vs `after('escape')` produce
  **identical** output (escape consumes `\$` whole before we're ever offered
  it). Use `after('escape')` like the ecosystem. Bracket rules must be
  `before('escape')` — that ordering genuinely decides behavior.
- Inline silent mode: `skipToken` runs every rule with `silent=true` and
  restores only `state.pos` afterwards — any token/pending/delimiters
  mutation under silent **leaks and double-renders**. Silent path: set
  `state.pos`, return.
- Block contract: main pass always `silent=false`; returning `true` without
  advancing `state.line` throws. Silent calls come only from terminator
  chains (`paragraph`, `blockquote`, `list`, `reference`) — detect only, no
  state changes. Without `alt: [paragraph, reference, blockquote, list]` a
  `$$` block cannot interrupt a paragraph.
- `table.mjs` terminates rows via the `'blockquote'` chain — a `$$` rule with
  `'blockquote'` in `alt` ends table rows (expected, matches ecosystem).
  Header-row `|` inside math changes `columnCount` and can kill the table.
- `escapedSplit` **drops** the backslash of `\|` before cells reach inline
  parsing — cell content already reads `$x|y$`; never un-escape `\|`
  ourselves. Code spans break on `|` identically (upstream #86/#697 closed
  unmerged) — purely a documentation matter.
- v15: parser internals become statics on the `markdownit` callable
  (`MarkdownIt.StateInline` etc.); types are bundled named exports;
  `RuleOptions` is not exported. `@types/markdown-it` (latest 14.2.0) is
  v14-shaped — keep it out of our public types.
- `ruler.at()` wipes a rule's `alt` chains — never use it to replace stock
  rules.
- vitepress bundles markdown-it into its dist; the `md` we receive is that
  bundled instance — never `instanceof`-check against our own markdown-it.

### Structural facts

- Table pipes are unfixable at the inline layer: `escapedSplit()` splits rows
  on unescaped `|` at block-parse time. Document `\|`; optionally an opt-in
  core pre-pass later. Block math can never appear in a table cell.
- Space-padded `$ a $`: default off (KaTeX/Pandoc convention), option to
  allow.
- Newlines inside inline math: preserve content, but KaTeX errors on `\\` in
  inline mode — `@mdit/plugin-katex` silences exactly `newLineInDisplayMode`.
- Code spans/fences already shield `$` — no action needed.
- markdown-it v14 vs v15: v15 (2026-07) removed `markdown-it/lib/*` subpaths
  and bundles named-export types (`@types/markdown-it` obsolete;
  `PluginWithOptions` gone). Peer on v14 per vitepress, but: no `lib/*`
  imports, declare our own structural types for `StateInline`/`StateBlock`
  and our own plugin type → works on both. Make `markdown-it` an optional
  peer (types only).
- Fence renderer must capture-and-delegate vitepress's Shiki `fence` rule.

### Test corpus to adapt (all MIT → ACKNOWLEDGEMENTS.md + license text)

- `markdown-it-dollarmath` `tests/fixtures/basic.md` (58 cases, MIT © 2021
  Chris Sewell; derived from MyST-Parser, BSD-3 © ExecutableBooks — credit
  both). Adopt its `.md` fixture format (`name\n.\ninput\n.\nexpected\n.`).
- `@vscode/markdown-it-katex` `test/fixtures/*.txt` (~90 cases, MIT ©
  Microsoft) — math-in-HTML + bare `\begin{}` coverage.
- `@mdit/plugin-tex` `__tests__/tex.spec.ts` (~80 cases, MIT © 2022-present
  MrHope) — brackets/fence/silent-mode coverage.
- `markdown-it-math` `test/test.js` (51 cases, MIT © 2015 Rúnar Berg
  Baugsson Sigríðarson) — configurable delimiters, indentation.
- Parser lineage credit: `markdown-it-katex` MIT © 2016 Waylon Flinn.

## Client-side extras (theme extension)

Decision (research verified in Chromium 148 against katex 0.18.4, temml
0.13.4, mathjax 4.1.3, @webc.site/math 0.1.34): **write our own client
helpers, import none of the upstream ones.**

Cornerstone: our `v-pre` wrapper carries **`data-tex`** (+ display-mode
marker). It's the only engine-independent copy-source mechanism — survives
render errors (engines emit no annotation on hard parse errors), KaTeX
`output:'html'`, MathJax v4 (which has **no MathML output jax** — only a
`data-latex` attr), and lets Temml keep soft line-breaking (`annotate: true`
silently forces `wrap:"none"` — with data-tex we don't need `annotate`).
Attribute round-trip is exact with standard escaping; read via
`getAttribute`, never regex serialized HTML.

Client entry `vitepress-plugin-math/client` exposing composables:

- `useCopyTex()` — one delegated `document` copy listener (no re-init on SPA
  nav). Algorithm adapted from KaTeX copy-tex (MIT © 2013-2020 Khan Academy /
  Eric Demaine; Temml variant MIT © 2020 Ron Kok — credit both), fixing its
  defects: cloneRange() (upstream mutates the live selection), probe root
  selectors one-at-a-time outermost-first (`closest()` with a selector list
  returns the nearest match — `math` beats `.katex` and leaks the visual
  layer), `annotation[encoding="application/x-tex"]` not bare `annotation`,
  newline padding around display math (upstream concatenates `$$…$$` onto the
  preceding paragraph), display delimiters actually used (Temml's copy-tex
  bug: defines display delims, never references them), no innerHTML string
  surgery. Root priority: `[data-tex]`, `.katex-display`, `.katex`,
  `mjx-container`, `math`; fallbacks read annotation / `[data-latex]` so it
  also works on non-plugin content. ~950 B min+gz, verified across all four
  engines + partial-selection expansion + error renders.
- `useTemmlRefs()` — Temml SSR emits `\ref`/`\eqref` as EMPTY anchors; only
  client `postProcess()` fills them. Import `temml/dist/temmlPostProcess.js`
  (1.2 KB gz standalone — NOT the 115 KB gz `temml` entry) inside
  `onContentUpdated`. (Equation numbers themselves are CSS counters, no JS.)
- Later, `data-tex`-powered extras: per-formula copy button /
  dblclick-to-copy, "show source" disclosure — no engine runtime needed;
  this is also the honest MathJax "copy" answer (its menu needs ~67 KB gz
  min via undocumented internals over SSR markup — rejected).

VitePress client integration facts (verified against 2.0.0-alpha.19 dist):
`Theme.setup()` is **deprecated** — expose composables for a wrapping Layout
component's `<script setup>`; `enhanceApp` runs during the SSR build (any
`document` touch breaks `docs:build`; side-effect import of upstream
copy-tex is fatal — it crashes in Node); `onContentUpdated` (exported from
`vitepress`) is the per-page DOM hook, self-deregistering.

Required CSS: `.katex .katex-mathml { user-select: none; -webkit-user-select:
none; }` — KaTeX's hidden MathML layer lacks it, so selections copy doubled
text (MathJax's `mjx-assistive-mml` already sets it; `cloneContents()`
ignores user-select so the handler still sees annotations). If we bake
MathJax assistive MathML at build time, we must ship the `mjx-assistive-mml`
rules from `chtml.styleSheet(doc)` or the MathML renders visibly.

A11y (build-time, not client): KaTeX `render-a11y-string` and mhchem are
build-time (they import the full engine); MathJax `assistiveMml` works under
liteAdaptor SSR (defaults on for raw handler). MathJax speech/braille baking
works but is inert without ~212 KB gz client runtime — skip for docs sites.

Search-index hazard worth handling: the TeX annotation is in `.textContent`,
so naive text extraction (VitePress local search, excerpts) ingests glyphs
AND raw LaTeX — consider stripping annotations for search or documenting it.

@webc.site/math has zero client-side pieces; license is **MulanPSL-2.0**
(not MIT) — reimplement, never adapt its code. Temml packaging note: its
`exports` puts `types` after `import`/`require` (dead condition) — expect
esbuild/attw warnings that are theirs, not ours.

## UI alignment with the default theme

Any actual UI design beyond what the typesetting engines and fonts provide —
error styling, focus outlines on scrollable display math, copy-feedback
affordances, source popovers, etc. — must use **VitePress default-theme CSS
variables** (`--vp-c-*`, `--vp-font-family-*`, `--vp-c-brand-*`, dark-mode
awareness via those tokens) and align with the default theme's look so it
feels native. No bespoke palettes/spacing systems; degrade gracefully when a
custom theme redefines the variables.

## Font policy (user requirements)

- Prefer **original upstream fonts** (the ones the engines / MDN MathML fonts
  guide recommend — e.g. Latin Modern Math, STIX Two Math, NewComputerModern)
  from canonical sources or the engine npm packages — not third-party
  repackagings.
- Vendor fonts into this repo **only with proper license compliance**: record
  each font's license (OFL 1.1, GUST Font License, …) and honor
  subset/redistribution obligations — OFL **Reserved Font Name** rules and
  GUST/LPPL-style renaming/notice rules. Keep license texts alongside
  vendored fonts and credit in ACKNOWLEDGEMENTS.md.
- **RFN handling is case-by-case**, because WebKit/Gecko/Chromium hardcode
  lists of math font family names for default MathML font
  rendering/negotiation, and CSS `@font-face` declarations participate in
  resolving those names. Renaming a subset (for RFN compliance) can opt it
  out of implicit negotiation. Per font, choose between: (a) vendor the
  original unmodified font (keeps the name legally), (b) subset + rename +
  explicit `font-family` on math elements, (c) subset keeping the name where
  the license permits (no RFN declared / GUST terms with notices). Check
  whether each font actually declares RFNs before assuming renaming is
  required.
- Reference: https://developer.mozilla.org/en-US/docs/Web/MathML/Guides/Fonts
  (OS math-font coverage gaps; pages should provide math web fonts).
- Subsetting happens via in-repo scripts (vitepress precedent `705c1be0`).
- Python tooling (e.g. `fonttools`/`pyftsubset`) runs via **uv** — prefer
  standalone scripts with PEP 723 inline metadata (`# /// script` blocks +
  `uv run scripts/subset-fonts.py`), so no venv is committed; uv-created
  venvs in scratchpad and brew-installed helpers are fine during
  development.

## Engines (verified Aug 2026: mathjax 4.1.3, katex 0.18.4, temml 0.13.4, @webc.site/math 0.1.34)

Peers (all optional): `mathjax ^4.1.0` · `katex >=0.18.2 <0.19.0` (0.18.2 =
prototype-pollution fix; 0.18.0 renamed 19 CSS classes `katex-*`) · `temml
^0.13.0` (breaks at minor level) · `@webc.site/math >=0.1.30 <0.2.0`
(ESM-only). Rethrow real errors from dynamic imports — only map
ERR_MODULE_NOT_FOUND-for-the-engine to an install hint.

### MathJax v4

- `import { init } from 'mathjax'` → `const MathJax = await init({ loader:
  { load: ['input/tex','output/chtml','adaptors/liteDOM'] }, tex, chtml })`.
- **Sync-render prerequisite**: `await
  MathJax.startup.output.font.loadDynamicFiles()` once at init (~255ms) —
  else out-of-base-range chars (fraktur/bb/script/Cyrillic…) make
  `tex2chtml()` throw "retry". CSS grows 9.7→22.6 KB, harmless.
- `tex2chtml(tex, { display })` — **`display` defaults to TRUE**, always
  pass. `adaptor = MathJax.startup.adaptor`; `adaptor.outerHTML(node)`.
  `tex2mml` returns a string. `tex2svg` needs `output/svg`.
- Per-page CSS: `MathJax.startup.output.clearCache()` before each page, then
  `adaptor.cssText(MathJax.chtmlStylesheet())` — verified deterministic.
  Alternative `chtml: { adaptiveCSS: false }` → fixed static CSS, emit once
  globally — but measured ~1.6 MB raw after `loadDynamicFiles()` (the ~220 KB
  figure is pre-preload). SVG: fixed ~6.5 KB `svgStylesheet()`.
  **Implementation decision: `output: 'svg'` is our MathJax default** (zero
  webfonts, tiny fixed CSS, deterministic); CHTML stays available with the
  full static stylesheet + vite-served fonts, documented as heavy.
- Per-page state: `MathJax.texReset()` (AMS numbering persists otherwise);
  `MathJax.done()` at build end if a11y components loaded (worker threads).
- **SVG mode** (`svg: { fontCache: 'local' }`) = zero webfonts, 5.9 KB fixed
  CSS, self-contained `<defs>` — offer as first-class "just works" mode.
- a11y: SSR never emits `aria-label` (explorer is browser-only). Enable
  `a11y/assistive-mml` + `enableAssistiveMml: true` (v4 default is FALSE) →
  hidden real MathML in static HTML; must ship its CSS (comes via
  `chtmlStylesheet()`). Speech baking → inert `data-semantic-speech`
  (SSML-ish) without a 212 KB client runtime — skip.
- Fonts: default font pkg `@mathjax/mathjax-newcm-font` (referenced faces 35
  = 345 KB woff2; 105 files 1.6 MB total; already effectively subset — never
  re-subset). `chtml.fontURL` is a plain URL prefix → vite plugin must emit
  the woff2 dir and point fontURL at it. `@mathjax/mathjax-tex-font` has no
  dynamic ranges (fully sync without preload) — optional alternative.
- v3→v4 traps: no `AllPackages`, no `input/tex-full`, no `tex-to-chtml`
  component; `mathjax-full` → `@mathjax/src`; `textmacros` now default-on.
- TeX packages: 41 loadable. `input/tex` default set = base, ams,
  newcommand, textmacros, noundefined, require, autoload, configmacros;
  autoload covers 15 more on demand. NOT autoloaded (list explicitly): bbm
  bboldx cases centernot colortbl colorv2 dsfont empheq gensymb mathtools
  physics setoptions tagformat texhtml textcomp units upgreek begingroup
  noerrors. Our default: `{'[+]': ['ams','mathtools','physics','cases',
  'empheq','upgreek','textcomp','units','centernot','gensymb','colortbl',
  'boldsymbol','cancel','color','braket','bbox','enclose','extpfeil',
  'amscd','bussproofs','mhchem']}`, `tags: 'ams'`. Exclude by default
  (opt-in): `require` (async under liteAdaptor), `html` (XSS surface),
  `texhtml`/`colorv2`/`fontsizev3` (compat shims), `setoptions` (breaks
  per-page statelessness).

### KaTeX

- `katex.renderToString(tex, { displayMode, output: 'htmlAndMathml'
  (default), throwOnError: false, strict: 'warn', … })` — sync, stateless,
  no init. mhchem: side-effect `import 'katex/contrib/mhchem'` at build.
- No auto-numbering (`\tag` only), no `\label`/`\ref`.
- CSS: `katex/dist/katex.min.css` (font-display: block) or
  `katex-swap.min.css`. Fonts: 20 woff2 = 260 KB (with woff/ttf fallbacks:
  60 files, 1.08 MB — vite emits ALL of them; only woff2 is fetched).
  Offer a woff2-only style variant to cut ~817 KB deploy weight.
- `output:'mathml'` still wraps in `<span class="katex">`.

### Temml

- `temml.renderToString(tex, { displayMode, annotate, wrap, throwOnError:
  false, … })` — sync, MathML-only, tiniest output (10 exprs = 1.6 KB vs
  KaTeX 16.5 KB / MathJax 8.9 KB + CSS). `definePreamble()` for
  document-wide macros; **fresh `macros` object per page** (`\gdef`
  persists).
- Display output: `<math display="block" class="tml-display">`. Equation
  numbering = pure CSS counter (per-page automatic). `\ref`/`\eqref` need
  client `postProcess` (composable).
- CSS variants ship in npm but **no math font does** (only Temml.woff2
  9.4 KB, which has an internal non-commercial nameID conflict — omit it;
  only needed for `\mathscr` with non-LM fonts). We author our own Temml
  CSS (adapted, MIT credit Ron Kok) + vendored math font.
- Broadest built-in TeX coverage of light engines: mhchem, physics, braket,
  mathtools, upgreek, cancel, texvc — zero extra imports. No `\bbox`,
  `\href` (removed 0.11.07).

### @webc.site/math

- `mathml(tex, block?) → string`; ESM-only, 60 KB unpacked, zero deps,
  fastest (5ms/1000). **Throws raw arrays, not Errors** (`[4, "\\ce"]`) —
  adapter must try/catch non-Error throws. Emits deprecated MathML3
  `mathvariant` values (ignored by MathML Core → `\mathbb{R}` renders as
  plain R). Thin coverage (no \binom/\not/\color/\displaystyle/physics/
  mhchem). Position as minimum-payload option with loud caveats, never
  default. MulanPSL-2.0 — reimplement, don't adapt code.

### Fonts — decisions

- **Subsetting is NOT worth it for MATH-table fonts**: MathML Core's UA
  stylesheet applies `text-transform: math-auto` mapping every single-char
  `<mi>` into U+1D400–1D7FF (Mathematical Alphanumeric Symbols), so that
  plane is mandatory; realistic savings only 12–39%. Higher-leverage:
  (1) MathJax SVG mode = zero fonts; (2) woff2-only KaTeX CSS (−817 KB);
  (3) vendor **original fonts converted OTF→woff2** (OFL-FAQ 2.7/2.8
  "Functional Equivalence": pure format conversion keeps the name legally;
  a glyph subset does not).
- Vendored fonts (canonical sources): **Latin Modern Math** (GUST
  latinmodern-math-1959.zip, GUST Font License = LPPL 1.3c: rename only
  *requested*; binding = cl.6b change-notice + ship/link original — include
  GUST-FONT-LICENSE.txt + change note "converted OTF→WOFF2, no glyph
  changes") — **default**. **STIX Two Math** (stipub/stixfonts ships
  upstream woff2 as-is; RFN is literally "TM Math", not "STIX") — macOS
  native alt. **Noto Sans Math** (no RFN; only real Android option; use
  TTF-derived — Temml docs: their woff2 has rendering issues). Optional:
  Libertinus Math (RFNs don't cover "Libertinus Math"). Skip Asana (RFN
  forces rename). **KaTeX fonts: OFL 1.1 with per-face RFNs (not MIT!) —
  use as shipped, never subset; ship OFL.txt if redistributed.** MathJax
  font pkgs: renamed families (mjx-*), no license files in tarballs — use
  from npm, don't vendor.
- **Never rely on UA `math` generic resolution**: Gecko resolves it from a
  process-global pref list that structurally can't see `@font-face`;
  Chromium has one name per platform and explicitly skips `@font-face` for
  generics; only WebKit recurses into author `@font-face` (and there it
  wins). Rule: our CSS always writes `math { font-family: "Latin Modern
  Math", math; }` explicitly, `local()`-first `@font-face` (Fred Wang
  MathFonts pattern) — makes RFN-vs-negotiation moot.
- MDN fonts guide facts: Cambria Math on Windows; STIX Two preinstalled
  macOS 13+; Android ships nothing.
- uv script scope: download originals (GUST zip, stipub release, notofonts
  release), verify, convert OTF→woff2 (fontTools), emit license files +
  manifest; optional `--subset` flag documents the RFN consequences.

### MathML in browsers (context for defaults)

MathML Core: Baseline widely-available since Jan 2023 (~94%); quality
Firefox > Safari ≥ Chromium. Chromium stretchy-operator bugs are
architectural (unfixed since 2020); **no linebreaking in any browser**
(min-content == max-content; MathJax's JS linebreaking is the strongest
argument for it on wide-equation sites); Interop 2026 has no MathML item.
A11y: NVDA 2026.1 has MathCAT built in but NVDA-in-Chromium math nav is
broken (Chromium bug); TalkBack/Narrator: nothing. MathJax is the only
engine whose a11y doesn't depend on browser MathML exposure. KaTeX MathML
is pre-Core quality; Firefox Reader View shows formulas twice (aria-hidden
ignored). Temml's MathML is genuinely Core-targeted.

### Competitor package-list diff (resolved)

- `@mdit/plugin-mathjax@1.2.0` is already on MathJax **v4** (since 0.24.0):
  39 packages explicit (missing autoload/require/fontsizev3, deliberate).
  Two flaws we avoid: (1) user `tex.packages` **replaces** its list (spread
  after) — we deep-merge or document `[+]` semantics; (2) it enables
  bbm/bboldx/dsfont without wiring `@mathjax/mathjax-{bbm,bboldx,dsfont}-
  font-extension` → "Invalid variant" fallbacks, and hardcodes a jsDelivr
  CDN `fontURL` for CHTML (we never CDN). If we let users enable
  bbm/bboldx/dsfont, document/wire the font-extension packages.
- `markdown-it-mathjax3@5` vendors a prebuilt MathJax **3.2.2** tex-svg-full
  bundle (via `mathxyjax3`, + XyJax), zero options, per-render `<style>`
  blocks, and `Math.random()` span ids → **non-deterministic output**
  (breaks reproducible builds/content hashing). Another differentiator:
  our output must be deterministic (beware MathJax SVG `<defs>` id counter
  — reset per page, e.g. via `svg.localID` or documented).
- v4 mechanics confirmed: bare `new TeX({})` = base only; combined
  components register 8; `autoload` covers 15 more; 19 never autoload.
  `Configuration.create` + `loader.paths.custom` is the third-party
  extension mechanism (the v2-era third-party repo was never ported).
- KaTeX/Temml current SSR APIs, CSS file paths, font lists, subsetting reality.
- `@webc.site/math` API surface.
