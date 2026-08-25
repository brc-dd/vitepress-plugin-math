/// <reference path="./engine-shims.d.ts" />
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

/** URL prefix the Vite plugin serves the MathJax webfonts under. */
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
   * URL prefix for CHTML webfonts. The default matches what the Vite plugin
   * serves; override when hosting fonts yourself.
   * @default MATHJAX_FONT_URL
   */
  fontURL?: string
  /**
   * Raw MathJax config, deep-merged last onto the generated one (its
   * `loader`/`tex`/`chtml`/`svg`/`options` blocks each override per-key).
   */
  mathjax?: Record<string, unknown>
}

function mergeBlock(base: Record<string, unknown>, user: unknown): Record<string, unknown> {
  return typeof user === 'object' && user !== null
    ? { ...base, ...(user as Record<string, unknown>) }
    : base
}

/**
 * MathJax v4 adapter. All async setup (component loading, dynamic font data)
 * happens here, so `render` is synchronous — including characters outside the
 * base ranges (fraktur, double-struck, script, …).
 */
export async function createMathJaxRenderer(
  options: MathJaxRendererOptions = {},
): Promise<MathRenderer> {
  const output = options.output ?? 'svg'
  const assistiveMml = options.assistiveMml ?? true
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
      createRequire(import.meta.url).resolve('@mathjax/mathjax-mhchem-font-extension')
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
    options: mergeBlock(assistiveMml ? { enableAssistiveMml: true } : {}, user['options']),
    startup: mergeBlock({ typeset: false }, user['startup']),
  }
  if (output === 'chtml') {
    config['chtml'] = mergeBlock(
      { fontURL: options.fontURL ?? MATHJAX_FONT_URL, adaptiveCSS: false },
      user['chtml'],
    )
  } else {
    config['svg'] = mergeBlock({ fontCache: 'local' }, user['svg'])
  }

  const { init } = await loadEngine('mathjax', 'mathjax', () => import('mathjax'))
  // The assistive-mml component sets `menuOptions` defaults meant for the
  // (unloaded) browser menu, and the option validator's warn hook isn't
  // reachable through the component config — drop exactly that one line
  // during init.
  const origWarn = console.warn
  console.warn = (...args: unknown[]) => {
    if (String(args[0]).includes('Invalid option "menuOptions"')) return
    origWarn(...args)
  }
  let MathJax
  try {
    MathJax = await init(config)
  } finally {
    console.warn = origWarn
  }
  // A failed component load makes init() resolve undefined (after logging).
  if (!MathJax?.startup) {
    throw new Error(
      '[vitepress-plugin-math] MathJax failed to initialize — see the loader errors above.',
    )
  }
  // Preload the font's dynamic range files — without this, any character
  // outside the base ranges makes the sync conversion throw "retry".
  await MathJax.startup.output.font?.loadDynamicFiles?.()
  const adaptor = MathJax.startup.adaptor

  return {
    name: 'mathjax',
    render: (tex, ctx) => {
      const node =
        output === 'svg'
          ? MathJax.tex2svg(tex, { display: ctx.display })
          : MathJax.tex2chtml(tex, { display: ctx.display })
      return adaptor.outerHTML(node)
    },
    reset: () => MathJax.texReset(),
    stylesheet: () =>
      adaptor.cssText(output === 'svg' ? MathJax.svgStylesheet() : MathJax.chtmlStylesheet()),
    finalize: () => MathJax.done?.(),
  }
}
