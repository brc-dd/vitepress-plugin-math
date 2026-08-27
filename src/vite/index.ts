import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { failedEngineRenderer } from '../engines/shared.ts'
import type { ApplyMathOptions } from '../index.ts'
import { mathPlugin, resolveRenderer } from '../index.ts'
import type { MathMarkdownIt, MathRenderer } from '../types.ts'

/**
 * Importable stylesheet module for engine-generated CSS. The Vite plugin
 * imports it for you under the MathJax engine; import it in your theme entry
 * only when you run with `inject: false` or `styles: false`.
 */
export const MATH_STYLES_ID = 'virtual:vitepress-plugin-math.css'

const RESOLVED_STYLES_ID = '\0' + MATH_STYLES_ID
const FONT_URL = '/vpm-fonts/mathjax'

/** Query the theme wrapper imports the real theme entry under. */
const REAL_ENTRY_QUERY = '?vpm-real'

/** The marker alone, as it survives the extra queries dev appends. */
const REAL_ENTRY_MARKER = 'vpm-real'

/** Theme entry filenames, in the order VitePress's resolver would pick them. */
const THEME_ENTRY_FILES = ['index.ts', 'index.mts', 'index.mjs', 'index.js']

/** The `<font-package>` segment of a served font URL, as the engine emits it. */
const FONT_PACKAGE_RE = new RegExp(`${FONT_URL}/([\\w.-]+)/`, 'g')

/** `<font-package>/<file>.woff2`, the part of a font URL past the mount path. */
const FONT_REQUEST_RE = /^([\w.-]+)\/([\w.-]+\.woff2)$/

const JSDELIVR = 'https://cdn.jsdelivr.net/npm'

/** The upstream KaTeX stylesheet, exactly as `styles/katex.css` imports it. */
const KATEX_IMPORT_RE = /@import\s+(['"])katex\/dist\/katex\.min\.css\1\s*;/

interface VitePluginLike {
  name: string
  [hook: string]: unknown
}

/**
 * The one thing every Vite plugin declares. Returning this instead of Vite's
 * own `Plugin` keeps `plugins: [math()]` type-checking in a VitePress config
 * without this package taking a type dependency on Vite.
 */
interface VitePluginObject {
  name: string
}

/** VitePress's `markdown` options, down to the hook we chain onto. */
interface MarkdownConfigLike {
  config?: (md: unknown) => unknown
}

/** The slice of VitePress's resolved site config the plugins read and write. */
interface SiteConfigLike {
  useWebFonts?: boolean
  themeDir?: string
  markdown?: MarkdownConfigLike
}

/** The slice of a resolved Vite config that VitePress hangs its site config on. */
interface ResolvedConfigLike {
  vitepress?: SiteConfigLike
}

/** Internal mutable view of the slice of a VitePress user config we touch. */
interface VitePressConfigLike {
  markdown?: MarkdownConfigLike
  vite?: {
    plugins?: unknown[]
  }
}

/** An engine, or the promise of one the caller shares across the plugins. */
type RendererSource = PromiseLike<MathRenderer> | MathRenderer

/** Forward slashes everywhere, the shape Vite gives module ids. */
function slash(path: string): string {
  return path.replace(/\\/g, '/')
}

/** Node resolution against this package's own export map (self-reference). */
const requireSelf = createRequire(import.meta.url)

/** Absolute path of one of our own entries, as published or as sources. */
function ownPath(subpath: string): string {
  return slash(requireSelf.resolve(`vitepress-plugin-math/${subpath}`))
}

/** Where an installed font package's files live, and which version they are. */
interface FontPackage {
  /** Absolute path of the package's `chtml/woff2` directory. */
  dir: string
  /** Installed version, pinned into the CDN URL so it can never drift. */
  version: string
}

/**
 * Locates one `\@mathjax/<pkg>` font package — the main font or any of the
 * font extensions (mhchem, …), each of which the engine references under its
 * own name.
 */
function mathJaxFontPackageDir(pkg: string): FontPackage | null {
  try {
    // Resolved through the mathjax package so the font version matches the
    // installed engine (the font packages are mathjax's own dependencies,
    // and under pnpm's strict layout they are only visible from there).
    const mathjaxPkg = requireSelf.resolve('mathjax/package.json')
    const requireFromMathJax = createRequire(mathjaxPkg)
    const fontPkg = requireFromMathJax.resolve(`@mathjax/${pkg}/package.json`)
    const { version } = requireFromMathJax(fontPkg) as { version?: string }
    if (!version) return null
    return { dir: fontPkg.replace(/package\.json$/, 'chtml/woff2'), version }
  } catch {
    return null
  }
}

/** The installed KaTeX version, or null when katex is not installed. */
function katexVersion(): string | null {
  try {
    const { version } = requireSelf('katex/package.json') as { version?: string }
    return version ?? null
  } catch {
    return null
  }
}

/**
 * Our own `styles/katex.css` — as an installed dependency (`dist` once
 * published, `src` through a linked workspace) or as this repo's own source.
 */
function isOwnKatexCss(id: string): boolean {
  const path = slash(id).replace(/[?#].*$/, '')
  if (!path.endsWith('/styles/katex.css')) return false
  return path.includes('/vitepress-plugin-math/') || path.endsWith('/src/styles/katex.css')
}

/**
 * Whether to source fonts from a CDN instead of self-hosting them. VitePress
 * resolves `useWebFonts` itself (user option, defaulting to a webcontainer
 * probe) and exposes the site config to Vite plugins; the probe is repeated
 * here as the fallback for a plain Vite app using this plugin directly.
 */
function usesWebFonts(config: ResolvedConfigLike): boolean {
  return config.vitepress?.useWebFonts ?? typeof process.versions['webcontainer'] === 'string'
}

/** One resolved theme entry per theme directory VitePress has reported. */
const themeEntries = new Map<string, string>()

/**
 * The module VitePress's app imports as `@theme/index`: the site's own theme
 * entry, or the default theme's when the site has none. Keyed on the
 * directory, which is what makes it follow a theme added or removed
 * mid-session — VitePress repoints `themeDir` and reloads the page.
 */
function themeEntry(themeDir: string): string {
  const dir = slash(themeDir).replace(/\/+$/, '')
  const cached = themeEntries.get(dir)
  if (cached !== undefined) return cached
  let entry = THEME_ENTRY_FILES.map((name) => `${dir}/${name}`).find((path) => existsSync(path))
  if (entry === undefined) {
    // No entry there means VitePress falls back to its default theme, which
    // is what `vitepress/theme` resolves to.
    try {
      entry = slash(requireSelf.resolve('vitepress/theme'))
    } catch {
      entry = ''
    }
  }
  themeEntries.set(dir, entry)
  return entry
}

/**
 * The stylesheets an engine's output needs, on top of the wrapper styles in
 * `core.css` (which the engine entries import themselves).
 */
function engineStyles(engine: string): string[] {
  switch (engine) {
    case 'mathjax':
      return [ownPath('styles/core.css'), MATH_STYLES_ID]
    case 'katex':
      return [ownPath('styles/katex.css')]
    // MathML output either way, so both want the same math-font stack.
    case 'temml':
    case 'webc':
      return [ownPath('styles/temml.css')]
    default:
      // A custom renderer, or an engine that failed to resolve: style our own
      // wrappers (error placeholders included) and leave the rest to whoever
      // brought the renderer.
      return [ownPath('styles/core.css')]
  }
}

/**
 * Wrapper module served in place of the theme entry — the real theme,
 * re-exported unchanged, plus the engine's stylesheets and the client
 * composables started from `Theme.setup()`. That is the one hook VitePress
 * calls from inside its root component, so composables get a real setup
 * context there (`enhanceApp` runs during the SSR build, too early).
 */
async function themeWrapper(
  entry: string,
  renderer: RendererSource,
  styles: boolean,
): Promise<string> {
  let engine = 'unresolved'
  try {
    engine = (await renderer).name
  } catch {
    // The render-time throw is the loud signal for an engine that failed to
    // resolve; here it only decides which stylesheets to pull in.
  }
  const real = JSON.stringify(entry + REAL_ENTRY_QUERY)
  const refs = engine === 'temml'
  const lines = [`import Theme from ${real}`, `export * from ${real}`]
  if (styles) for (const id of engineStyles(engine)) lines.push(`import ${JSON.stringify(id)}`)
  lines.push(
    `import { useCopyTex${refs ? ', useTemmlRefs' : ''} } from ${JSON.stringify(ownPath('client'))}`,
    // A theme's own `setup` may sit further up its `extends` chain, which
    // VitePress resolves as `{ ...base, ...theme }` — so the one this
    // replaces is the first one found walking outside in.
    'const inherited = (t) => t.setup ?? (t.extends ? inherited(t.extends) : undefined)',
    'export default {',
    '  ...Theme,',
    '  setup() {',
    '    inherited(Theme)?.()',
    '    useCopyTex()',
    ...(refs ? ['    useTemmlRefs()'] : []),
    '  },',
    '}',
  )
  return lines.join('\n') + '\n'
}

/** Markdown option objects already chained, so a re-run cannot double up. */
const chainedMarkdown = new WeakSet<MarkdownConfigLike>()

/**
 * Chains the markdown-it plugin onto a VitePress `markdown` options object,
 * ahead of whatever `config` hook was already there.
 *
 * A resolution failure must not escape the hook: VitePress runs it while
 * constructing the dev server, including on a config-reload restart, where a
 * throw takes the process down. The parsing rules register either way, and
 * the failure is rethrown per expression at render time — a dev error overlay
 * with the server alive, a hard failure during `vitepress build`.
 */
function chainMarkdown(
  markdown: MarkdownConfigLike,
  options: ApplyMathOptions,
  renderer: RendererSource,
): void {
  if (chainedMarkdown.has(markdown)) return
  chainedMarkdown.add(markdown)
  const userConfig = markdown.config
  markdown.config = async (md: unknown) => {
    let resolved: MathRenderer | undefined
    let failure: unknown
    try {
      resolved = await renderer
    } catch (error) {
      failure = error
    }
    mathPlugin(md as MathMarkdownIt, {
      ...options,
      renderer: resolved ?? failedEngineRenderer(failure),
    })
    await userConfig?.(md)
  }
}

/**
 * Vite plugins serving the engine's runtime-generated stylesheet as
 * `virtual:vitepress-plugin-math.css`, plus the MathJax CHTML webfonts under
 * `/vpm-fonts/mathjax/<font-package>` (dev middleware + emitted build assets —
 * self-hosted by default). Which font packages those are is read back out of
 * the stylesheet, so a site loading a font extension (mhchem, …) gets its
 * files too. Pass the same renderer (or promise of one) that the markdown
 * plugin uses.
 *
 * Under VitePress's `useWebFonts` — on by default inside a webcontainer,
 * where serving font binaries is the expensive part — the MathJax and KaTeX
 * fonts come from jsDelivr instead, each pinned to its installed version, and
 * nothing local is served or emitted for them. Temml stays self-hosted either
 * way: its Latin Modern WOFF2 is vendored in this package, which is not yet on
 * npm, so there is no CDN copy to point at.
 *
 * Returns an array — the KaTeX stylesheet swap has to run `enforce: 'pre'`, so
 * it is its own plugin. Vite flattens nested arrays in `plugins`.
 *
 * Part of what {@link math} returns; exported for integrations that compose
 * the pieces themselves rather than as an API to reach for first.
 */
export function mathStylesPlugin(renderer: RendererSource): VitePluginObject[] {
  /** Font packages the loaded stylesheet still points at our own font URL. */
  let localFontPackages: string[] = []
  let webFonts = false

  const katexCdnPlugin = {
    name: 'vitepress-plugin-math:katex-cdn',
    // Ahead of Vite's css plugin, which inlines `@import`s of local files.
    // An absolute http(s) one is left external and hoisted as-is.
    enforce: 'pre',

    transform(code: string, id: string) {
      if (!webFonts || !isOwnKatexCss(id)) return undefined
      const version = katexVersion()
      if (!version) return undefined
      const url = `${JSDELIVR}/katex@${version}/dist/katex.min.css`
      const swapped = code.replace(KATEX_IMPORT_RE, `@import url('${url}');`)
      if (swapped === code) return undefined
      return { code: swapped, map: null }
    },
  } satisfies VitePluginLike

  const stylesPlugin = {
    name: 'vitepress-plugin-math:styles',

    configResolved(config: ResolvedConfigLike) {
      webFonts = usesWebFonts(config)
    },

    config() {
      // `useTemmlRefs()` imports temml's UMD post-processor at runtime, which
      // Vite would otherwise discover mid-session and answer with an
      // optimize-and-reload. Pre-bundling it at server start keeps the page put.
      // Gated on temml merely being installed, not on it being the active
      // engine: a theme may call `useTemmlRefs()` under any engine, and an
      // engine-independent list also stays stable when the engine changes
      // (Vite re-optimizes when `optimizeDeps` does).
      try {
        requireSelf.resolve('temml/package.json')
      } catch {
        return undefined
      }
      return { optimizeDeps: { include: ['temml/dist/temmlPostProcess.js'] } }
    },

    resolveId(id: string) {
      if (id === MATH_STYLES_ID) return RESOLVED_STYLES_ID
      return undefined
    },

    async load(id: string) {
      if (id !== RESOLVED_STYLES_ID) return undefined
      let resolved: MathRenderer
      try {
        resolved = await renderer
      } catch {
        // The render-time throw is the single loud signal for an engine that
        // failed to resolve; failing this module would take down the whole
        // page instead of just its math.
        return ''
      }
      const css = resolved.stylesheet?.() ?? ''
      if (!css.includes(FONT_URL)) return css
      // The stylesheet is the source of truth for which font packages are in
      // play: the engine names one per `@font-face` prefix, and which ones
      // appear depends on the TeX packages the site actually loaded.
      const packages = new Set<string>()
      for (const match of css.matchAll(FONT_PACKAGE_RE)) if (match[1]) packages.add(match[1])
      const local: string[] = []
      let out = css
      for (const pkg of packages) {
        const font = webFonts ? mathJaxFontPackageDir(pkg) : null
        if (!font) {
          // Self-hosting, or a package we cannot resolve a version for —
          // either way its files stay ours to serve.
          local.push(pkg)
          continue
        }
        out = out.replaceAll(
          `${FONT_URL}/${pkg}`,
          `${JSDELIVR}/@mathjax/${pkg}@${font.version}/chtml/woff2`,
        )
      }
      localFontPackages = local
      return out
    },

    async configureServer(server: {
      middlewares: {
        use(path: string, handler: (req: unknown, res: unknown, next: () => void) => void): void
      }
    }) {
      if (webFonts) return
      const { readFile } = await import('node:fs/promises')
      server.middlewares.use(FONT_URL, (req, res, next) => {
        const url = (req as { url?: string }).url ?? ''
        const path = url.replace(/^\/+/, '').replace(/[?#].*$/, '')
        const [, pkg, name] = FONT_REQUEST_RE.exec(path) ?? []
        const dir = pkg ? mathJaxFontPackageDir(pkg)?.dir : undefined
        if (!dir || !name) return next()
        readFile(`${dir}/${name}`).then(
          (data) => {
            const r = res as {
              setHeader(k: string, v: string): void
              end(d: Uint8Array): void
            }
            r.setHeader('Content-Type', 'font/woff2')
            r.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
            r.end(data)
          },
          () => next(),
        )
      })
    },

    async generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      // KaTeX's stylesheet lists woff/ttf fallbacks after each woff2 source.
      // No supported browser fetches them, but Vite still emits ~800 KB of
      // font files per deploy — strip the fallback sources from the CSS and
      // drop the orphaned assets.
      for (const [key, file] of Object.entries(bundle)) {
        const asset = file as { type?: string; fileName?: string; source?: unknown }
        if (asset.type !== 'asset' || !asset.fileName) continue
        if (/KaTeX_[^/]+\.(?:woff|ttf)$/.test(asset.fileName)) {
          delete bundle[key]
        }
      }

      if (!localFontPackages.length) return
      const { readdir, readFile } = await import('node:fs/promises')
      const self = this as unknown as {
        emitFile(file: { type: 'asset'; fileName: string; source: Uint8Array }): void
      }
      for (const pkg of localFontPackages) {
        const dir = mathJaxFontPackageDir(pkg)?.dir
        if (!dir) continue
        // Walk the directory rather than the stylesheet's reference list:
        // upstream names a handful of files it does not ship, and a copy
        // driven by the references would fail on those.
        for (const name of await readdir(dir)) {
          if (!name.endsWith('.woff2')) continue
          self.emitFile({
            type: 'asset',
            fileName: `${FONT_URL.slice(1)}/${pkg}/${name}`,
            source: await readFile(`${dir}/${name}`),
          })
        }
      }
    },

    async writeBundle(options: { dir?: string }) {
      // VitePress emits its final concatenated stylesheet from a post-ordered
      // plugin after our generateBundle ran, so the dangling references to
      // the dropped fallbacks are cleaned on disk.
      const outDir = options.dir
      if (!outDir) return
      const { readdir, readFile, writeFile } = await import('node:fs/promises')
      let names: string[] = []
      try {
        names = await readdir(outDir, { recursive: true })
      } catch {
        return
      }
      for (const name of names) {
        if (!name.endsWith('.css')) continue
        const path = `${outDir}/${name}`
        const text = await readFile(path, 'utf8')
        const stripped = text.replace(
          /,\s*url\([^)]*KaTeX_[^)]*\.(?:woff|ttf)\)\s*format\((["'])(?:woff|truetype)\1\)/g,
          '',
        )
        if (stripped !== text) await writeFile(path, stripped)
      }
    },
  } satisfies VitePluginLike

  return [katexCdnPlugin, stylesPlugin]
}

/**
 * The plugin that needs no user wiring at all: it hangs the markdown-it
 * plugin off VitePress's resolved site config, and serves the site's theme
 * entry wrapped in a module that pulls in the engine's stylesheets and starts
 * the client composables.
 *
 * Ordered `pre` for the markdown half — VitePress builds its markdown
 * renderer in its own `configResolved`, reading `siteConfig.markdown` as it
 * goes, so ours has to be in place by then.
 */
function mathInjectPlugin(
  options: ApplyMathOptions,
  renderer: RendererSource,
  skipMarkdown: boolean,
): VitePluginObject {
  const styles = options.styles !== false
  // `inject: false` turns off only the theme wrapping (css + composables);
  // the markdown wiring below is the parsing itself and always stays on.
  const wrapTheme = options.inject !== false
  let site: SiteConfigLike | undefined

  const plugin = {
    name: 'vitepress-plugin-math:inject',
    enforce: 'pre',

    configResolved(config: ResolvedConfigLike) {
      const resolved = config.vitepress
      if (!resolved) {
        throw new Error(
          "[vitepress-plugin-math] `math()` must run inside VitePress — it's a plugin for " +
            'the `vite.plugins` array of a VitePress config (`.vitepress/config.ts`), not ' +
            'for a plain Vite config. In a plain Vite app, wire the markdown-it plugin ' +
            'yourself with `applyMath()`.',
        )
      }
      site = resolved
      // `withMath` chains the user config object directly, which is what
      // keeps it working on a VitePress that reads `markdown` once, up front.
      if (!skipMarkdown) chainMarkdown((resolved.markdown ??= {}), options, renderer)
    },

    resolveId(source: string) {
      // The wrapper's import of the real entry, already an absolute path:
      // hand it straight back, so Vite reads the file off disk and runs its
      // own transforms over it.
      return wrapTheme && source.endsWith(REAL_ENTRY_QUERY) ? source : undefined
    },

    async load(id: string) {
      if (!wrapTheme) return undefined
      // Dev appends its own queries (`?t=…`) to the ids it re-requests, so
      // the marker is matched anywhere in the id, not just at the end.
      if (id.includes(REAL_ENTRY_MARKER)) return undefined
      const themeDir = site?.themeDir
      if (!themeDir) return undefined
      const entry = themeEntry(themeDir)
      if (!entry || slash(id.replace(/[?#].*$/s, '')) !== entry) return undefined
      return themeWrapper(entry, renderer, styles)
    },
  } satisfies VitePluginLike

  return plugin
}

/** The full plugin set over a renderer the caller already owns. */
function mathPlugins(
  options: ApplyMathOptions,
  renderer: RendererSource,
  skipMarkdown: boolean,
): VitePluginObject[] {
  return [mathInjectPlugin(options, renderer, skipMarkdown), ...mathStylesPlugin(renderer)]
}

/**
 * The whole plugin: math in your markdown, the engine's styles, its fonts and
 * the client composables, from one entry in `vite.plugins` and nothing else.
 *
 * ```ts
 * // .vitepress/config.ts
 * import { defineConfig } from 'vitepress'
 * import { math } from 'vitepress-plugin-math/vite'
 *
 * export default defineConfig({
 *   vite: { plugins: [math({ engine: 'katex' })] },
 * })
 * ```
 *
 * No `markdown.config`, no theme entry, no stylesheet imports: the plugin
 * wires the markdown-it rules into VitePress's resolved site config, and
 * serves the site's theme entry (its own, or the default theme's) wrapped in
 * a module that adds the engine's stylesheets and `useCopyTex()`. Themes
 * using `extends` chain through untouched, and a theme's own `setup` still
 * runs. Turn the wrapping off with `inject: false`, or keep it but drop the
 * stylesheet imports with `styles: false`.
 *
 * MathJax webfonts are self-hosted, except under VitePress's `useWebFonts`
 * (see {@link mathStylesPlugin}).
 *
 * An engine that fails to resolve (package not installed, unknown name) does
 * not break config loading: the failure is rethrown the first time a page
 * renders math, so dev shows an error overlay and `vitepress build` fails.
 */
export function math(options: ApplyMathOptions = {}): VitePluginObject[] {
  // Eager: the markdown hook, the css loader and the theme wrapper all await
  // this, and the theme loads before any markdown is rendered.
  const renderer = resolveRenderer(options)
  // Nothing awaits this until the first of those hooks runs, so mark a
  // rejection handled here — an unhandled one in that window ends the
  // process. Every awaiter handles it itself, and still sees it.
  renderer.catch(() => {})
  return mathPlugins(options, renderer, false)
}

export default math

/**
 * Compatibility path for a VitePress that reads `markdown` out of the user
 * config once, before Vite plugins run: same wiring as {@link math}, except
 * the markdown-it plugin is chained onto the config object here and now.
 *
 * ```ts
 * // .vitepress/config.ts
 * import { defineConfig } from 'vitepress'
 * import { withMath } from 'vitepress-plugin-math/vite'
 *
 * export default withMath(defineConfig({ ... }), { engine: 'temml' })
 * ```
 *
 * Everything else is {@link math}, including the theme wrapping — so styles
 * and `useCopyTex()` come along here too, with no theme entry to write.
 * Prefer `math()`, which is one plugin in `vite.plugins` and needs no
 * wrapping of the config object at all.
 */
export function withMath<T extends object>(config: T, options: ApplyMathOptions = {}): T {
  const renderer = resolveRenderer(options)
  renderer.catch(() => {})

  const cfg = config as VitePressConfigLike
  chainMarkdown((cfg.markdown ??= {}), options, renderer)
  const vite = (cfg.vite ??= {})
  ;(vite.plugins ??= []).push(mathPlugins(options, renderer, true))

  return config
}
