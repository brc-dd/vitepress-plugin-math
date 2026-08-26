/// <reference path="./engine-shims.d.ts" />
import type { MathJaxInstance } from 'mathjax'
import type { MathRenderer } from '../types.ts'
import { loadEngine } from './shared.ts'

/**
 * TeX extension packages enabled on top of the `input/tex` component's own
 * defaults (base, ams, newcommand, textmacros, noundefined, autoload,
 * configmacros; the `\require` macro is removed). Chosen for docs sites;
 * deliberately excluded:
 * `html` (raw-attribute injection — XSS surface from untrusted markdown),
 * `setoptions` (in-document TeX could mutate parser config and break
 * per-page statelessness), the v2/v3 compat shims (`texhtml`, `colorv2`,
 * `fontsizev3`), and the fonts-needing `bbm`/`bboldx`/`dsfont` (they require
 * the matching \@mathjax font-extension packages — enable via `texPackages`
 * after installing those).
 */
export const DEFAULT_TEX_PACKAGES: readonly string[] = [
  'amscd',
  'bbox',
  'boldsymbol',
  'braket',
  'bussproofs',
  'cancel',
  'cases',
  'centernot',
  'color',
  'colortbl',
  'empheq',
  'enclose',
  'extpfeil',
  'gensymb',
  'mathtools',
  'mhchem',
  'physics',
  'tagformat',
  'textcomp',
  'units',
  'upgreek',
]

/**
 * URL prefix the Vite plugin serves the MathJax webfonts under. Each font
 * package gets its own directory below it, so the main font and every font
 * extension stay distinguishable: `/vpm-fonts/mathjax/<font-package>/<file>`.
 */
export const MATHJAX_FONT_URL = '/vpm-fonts/mathjax'

export interface MathJaxRendererOptions {
  /**
   * Output format. `svg` needs no webfonts at all — each expression is
   * self-contained (`fontCache: 'local'`) with a fixed ~6 KB stylesheet.
   * `chtml` uses webfonts and smaller per-expression markup, but its full
   * static stylesheet (`adaptiveCSS: false`, required for a single
   * site-wide CSS file) is ~1.6 MB raw — cacheable, but heavy.
   * @default 'svg'
   */
  output?: 'chtml' | 'svg'
  /**
   * TeX extension packages appended to the loader defaults (replaces
   * `DEFAULT_TEX_PACKAGES`, not the built-in base set).
   */
  texPackages?: readonly string[]
  /**
   * Embed hidden assistive MathML (`<mjx-assistive-mml>`) in the output so
   * screen readers get real MathML from the static HTML.
   * @default true
   */
  assistiveMml?: boolean
  /**
   * Drop the `data-latex`/`data-latex-item` attributes the TeX input jax
   * stamps on every node — the visual tree and the assistive-MathML copy
   * alike. The wrapper's own `data-tex` already carries the TeX source once
   * per expression, so removing them costs nothing and takes roughly 14% off
   * CHTML output and 5% off SVG.
   * @default true
   */
  stripLatexData?: boolean
  /**
   * URL prefix for CHTML webfonts, with a `/<font-package>` segment appended
   * per font package. The default matches what the Vite plugin serves;
   * override when hosting fonts yourself.
   * @default MATHJAX_FONT_URL
   */
  fontURL?: string
  /**
   * Raw MathJax config, deep-merged last onto the generated one (its
   * `loader`/`tex`/`chtml`/`svg`/`options` blocks each override per-key).
   */
  mathjax?: Record<string, unknown>
}

/**
 * The startup internals the reconfigure path drives, on top of the convenience
 * API the ambient shims declare.
 */
interface MathJaxStartupInternals {
  config: {
    startup: { output?: string }
    [block: string]: unknown
  }
  loader: { load(...names: string[]): Promise<unknown> }
  startup: {
    getComponents(): void
    makeMethods(): void
  }
}

type MathJaxRuntime = MathJaxInstance & MathJaxStartupInternals

/** A built MathJax config plus the components it needs loaded. */
interface MathJaxSetup {
  load: string[]
  config: Record<string, unknown>
}

/**
 * The single MathJax instance this process may have. `init()` merges its
 * argument into the previous config per array index and resolves through an
 * already-settled startup promise, so a second call never switches output —
 * it silently keeps the first one. Later renderers reconfigure this instance
 * in place instead.
 */
let instance: MathJaxRuntime | undefined

/**
 * Components loaded so far. MathJax has no unload, so a TeX package dropped
 * from `texPackages` stays loaded — harmless, because a reconfigure also
 * rewrites `tex.packages` and the parser only sees what is listed there.
 */
const loadedComponents = new Set<string>()

/** Signature of the config `instance` is currently running. */
let currentSignature: string | undefined

/** The `data-latex`/`data-latex-item` attributes the TeX jax stamps on nodes. */
const LATEX_DATA_ATTRIBUTE = / data-latex(?:-item)?="[^"]*"/g

/** The bare package specifier CHTML fonts emit in their `\@font-face` rules. */
const FONT_PACKAGE_PREFIX = /@mathjax\/([^/"()\s]+)\/chtml\/woff2/g

function mergeBlock(base: Record<string, unknown>, user: unknown): Record<string, unknown> {
  return typeof user === 'object' && user !== null
    ? { ...base, ...(user as Record<string, unknown>) }
    : base
}

/**
 * Runs `fn` with the option validator's one unavoidable complaint silenced:
 * the assistive-mml component sets `menuOptions` defaults meant for the
 * (unloaded) browser menu, and the validator's warn hook isn't reachable
 * through the component config. Wraps `init()` and every reconfigure, both of
 * which re-run the option validation.
 */
async function withMenuWarnFiltered<T>(fn: () => T | PromiseLike<T>): Promise<T> {
  const origWarn = console.warn
  console.warn = (...args: unknown[]) => {
    if (String(args[0]).includes('Invalid option "menuOptions"')) return
    origWarn(...args)
  }
  try {
    return await fn()
  } finally {
    console.warn = origWarn
  }
}

/** Builds the component list and config for one set of renderer options. */
async function buildSetup(
  options: MathJaxRendererOptions,
  output: 'chtml' | 'svg',
  assistiveMml: boolean,
): Promise<MathJaxSetup> {
  const user = options.mathjax ?? {}

  let texPackages = [...(options.texPackages ?? DEFAULT_TEX_PACKAGES)]
  let mhchemSkipped = false
  // mhchem's CHTML/SVG glyphs live in a separate font-extension package.
  // When it isn't installed, drop mhchem from the defaults (with a hint)
  // instead of failing the whole MathJax startup; an explicit `texPackages`
  // keeps it and surfaces the loader error.
  if (!options.texPackages && texPackages.includes('mhchem')) {
    const { createRequire } = await import('node:module')
    try {
      // Resolve from the mathjax package's own context — that's where its
      // loader imports the extension from, and under pnpm's strict layout
      // the consumer-installed extension is only visible there, not from
      // this package.
      const requireFromHere = createRequire(import.meta.url)
      const requireFromMathJax = createRequire(requireFromHere.resolve('mathjax/package.json'))
      // Probe a concrete subpath — the extension's exports map has no bare
      // `.` entry, so resolving the package id alone throws even when it is
      // installed.
      requireFromMathJax.resolve('@mathjax/mathjax-mhchem-font-extension/package.json')
    } catch {
      texPackages = texPackages.filter((name) => name !== 'mhchem')
      mhchemSkipped = true
      console.warn(
        '[vitepress-plugin-math] mhchem support skipped — install ' +
          '`@mathjax/mathjax-mhchem-font-extension` to enable `\\ce`/`\\pu` with MathJax.',
      )
    }
  }
  // Listing a package under `tex.packages` requires its component to be
  // loaded — only ~15 extensions autoload; the rest must be preloaded here
  // (which also keeps SSR fully synchronous, no async-retry paths).
  const load = [
    'input/tex',
    `output/${output}`,
    'adaptors/liteDOM',
    ...texPackages.map((name) => `[tex]/${name}`),
  ]
  if (assistiveMml) load.push('a11y/assistive-mml')

  const config: Record<string, unknown> = {
    loader: mergeBlock({ load }, user['loader']),
    tex: mergeBlock(
      {
        // `[-] require` drops the \require macro: page content must not load
        // arbitrary extensions at build time (and it's async under liteDOM).
        packages: { '[+]': texPackages, '[-]': ['require'] },
        tags: 'ams',
        // A skipped mhchem must not autoload either — a lazy component load
        // during a sync render throws the async-retry error.
        ...(mhchemSkipped ? { autoload: { mhchem: [] } } : {}),
      },
      user['tex'],
    ),
    options: mergeBlock(
      // Naming the option before the a11y component has ever loaded would
      // trip the validator, so it stays out of the very first config. Once
      // the component is in (and it can never be unloaded), turning assistive
      // MathML off has to be spelled out — its document default is on.
      assistiveMml || loadedComponents.has('a11y/assistive-mml')
        ? { enableAssistiveMml: assistiveMml }
        : {},
      user['options'],
    ),
    startup: mergeBlock({ typeset: false }, user['startup']),
  }
  // v4 enables in-line linebreaking by default, which splits inline
  // expressions into separately positioned segments — under liteDOM SSR the
  // inter-segment spacing collapses (`a≠ 0`). Disable it for static output.
  const linebreaks = { inline: false }
  if (output === 'chtml') {
    // No `fontURL` here: it only reaches the main font's `@font-face` rules,
    // while every font extension keeps emitting a bare package specifier no
    // browser can fetch. `stylesheet()` rewrites all of them uniformly.
    config['chtml'] = mergeBlock({ adaptiveCSS: false, linebreaks }, user['chtml'])
  } else {
    // `localID` pins the glyph-id namespace ordinarily derived from a
    // process-global counter, so identical input yields byte-identical SVG
    // across pages and rebuilds. With `fontCache: 'local'` every expression
    // carries its own `<defs>`, so the shared namespace stays correct
    // (duplicate ids reference identical path data).
    config['svg'] = mergeBlock({ fontCache: 'local', linebreaks, localID: 'vpm' }, user['svg'])
  }

  return { load, config }
}

/** Boots MathJax for the first (and only) time in this process. */
async function initMathJax(setup: MathJaxSetup): Promise<MathJaxRuntime> {
  const { init } = await loadEngine('mathjax', 'mathjax', () => import('mathjax'))
  const started = await withMenuWarnFiltered(() => init(setup.config))
  // A failed component load makes init() resolve undefined (after logging).
  if (!started?.startup) {
    throw new Error(
      '[vitepress-plugin-math] MathJax failed to initialize — see the loader errors above.',
    )
  }
  return started as MathJaxRuntime
}

/**
 * Switches the live instance over to `setup` and returns it. Drives the
 * startup internals directly, because `init()` may not run a second time:
 * load whatever components are new, swap the config blocks, then rebuild the
 * input/output jax, the adaptor and the document from them.
 */
async function reconfigureMathJax(
  mathJax: MathJaxRuntime,
  setup: MathJaxSetup,
  output: 'chtml' | 'svg',
): Promise<MathJaxRuntime> {
  const newComponents = setup.load.filter((name) => !loadedComponents.has(name))
  // An output component pulls its font package in as an extra load, so this
  // one call is all a format switch needs.
  if (newComponents.length) await mathJax.loader.load(...newComponents)

  mathJax.config.startup.output = output
  // Whole blocks, never a `[+]` append: `getInputJax()` builds the TeX jax
  // with `new inputClass(config.tex)`, so `packages` is merged against the
  // class defaults afresh every time.
  mathJax.config['tex'] = setup.config['tex']
  mathJax.config['options'] = setup.config['options']
  // The output block is merged rather than replaced — loading `output/<name>`
  // plants the font class and its URL prefix in there, and a rebuild without
  // them fails on a null font.
  mathJax.config[output] = {
    ...(mathJax.config[output] as Record<string, unknown> | undefined),
    ...(setup.config[output] as Record<string, unknown>),
  }

  await withMenuWarnFiltered(() => {
    mathJax.startup.getComponents()
    mathJax.startup.makeMethods()
  })
  return mathJax
}

/** Brings the process-wide instance in line with `setup`, booting it if needed. */
async function ensureMathJax(
  setup: MathJaxSetup,
  output: 'chtml' | 'svg',
): Promise<MathJaxRuntime> {
  const mathJax = instance
    ? await reconfigureMathJax(instance, setup, output)
    : await initMathJax(setup)
  instance = mathJax
  for (const name of setup.load) loadedComponents.add(name)
  // Preload the font's dynamic range files — without this, any character
  // outside the base ranges makes the sync conversion throw "retry".
  await mathJax.startup.output.font?.loadDynamicFiles?.()
  return mathJax
}

/**
 * The live instance, re-read on every call: a renderer created later may have
 * reconfigured it, which replaces the adaptor, the document and the `tex2*`
 * methods wholesale.
 */
function live(): MathJaxRuntime {
  if (!instance) throw new Error('[vitepress-plugin-math] MathJax is not initialized.')
  return instance
}

/**
 * MathJax v4 adapter. All async setup (component loading, dynamic font data)
 * happens here, so `render` is synchronous — including characters outside the
 * base ranges (fraktur, double-struck, script, …).
 *
 * One process holds one MathJax instance. Calling this again with the same
 * options hands back a renderer bound to it; calling it with different ones
 * reconfigures it in place, which is what makes a dev-server config reload
 * pick up a new `output` or `texPackages` without a restart.
 */
export async function createMathJaxRenderer(
  options: MathJaxRendererOptions = {},
): Promise<MathRenderer> {
  const output = options.output ?? 'svg'
  const assistiveMml = options.assistiveMml ?? true
  const fontURL = options.fontURL ?? MATHJAX_FONT_URL
  const stripLatexData = options.stripLatexData ?? true

  // Everything that shapes the MathJax config, in a stable order. Function
  // values inside the raw config serialize as `undefined`, so a change
  // confined to one (a `tex.macros` callback, say) does not reconfigure.
  const signature = JSON.stringify({
    output,
    texPackages: [...(options.texPackages ?? DEFAULT_TEX_PACKAGES)].sort(),
    assistiveMml,
    fontURL,
    mathjax: options.mathjax ?? {},
  })
  if (!instance || signature !== currentSignature) {
    await ensureMathJax(await buildSetup(options, output, assistiveMml), output)
    currentSignature = signature
  }

  return {
    name: 'mathjax',
    render: (tex, ctx) => {
      const mathJax = live()
      // Always this renderer's own method: a reconfigure rebinds every stale
      // `tex2*` name to whatever output is current, so `tex2svg` can happily
      // emit CHTML after a switch.
      const node =
        output === 'svg'
          ? mathJax.tex2svg(tex, { display: ctx.display })
          : mathJax.tex2chtml(tex, { display: ctx.display })
      const html = mathJax.startup.adaptor.outerHTML(node)
      // Safe as a string edit: the adaptor escapes `"` as `&quot;` inside
      // attribute values, so the match can never run past the closing quote.
      // `data-mml-node` stays — MathJax's own stylesheet selects on it.
      return stripLatexData ? html.replace(LATEX_DATA_ATTRIBUTE, '') : html
    },
    reset: () => {
      const mathJax = live()
      mathJax.texReset()
      // Also reset the output's caches so identical input renders
      // byte-identical across pages and rebuilds: the SVG glyph-id counter,
      // and CHTML's character cache (a no-op under `adaptiveCSS: false`).
      mathJax.startup.output.clearFontCache?.()
      mathJax.startup.output.clearCache?.()
    },
    stylesheet: () => {
      const mathJax = live()
      const css = mathJax.startup.adaptor.cssText(
        output === 'svg' ? mathJax.svgStylesheet() : mathJax.chtmlStylesheet(),
      )
      // CHTML font packages hard-code a bare `@mathjax/<pkg>/chtml/woff2`
      // specifier in their `@font-face` rules, which 404s in every browser.
      // Keep the package segment so each one can be served from its own
      // directory.
      //
      // Nothing in this stylesheet may be trimmed: the `user-select: none`
      // rule on `mjx-assistive-mml` is the only thing keeping the hidden
      // MathML copy from being duplicated into the clipboard (mathjax#1350).
      return css.replace(FONT_PACKAGE_PREFIX, `${fontURL}/$1`)
    },
    finalize: () => live().done?.(),
  }
}
