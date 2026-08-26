import { createRequire } from 'node:module'
import { failedEngineRenderer } from '../engines/shared.ts'
import type { ApplyMathOptions } from '../index.ts'
import { mathPlugin, resolveRenderer } from '../index.ts'
import type { MathMarkdownIt, MathRenderer } from '../types.ts'

/**
 * Importable stylesheet module for engine-generated CSS (import it in your
 * theme entry when using the MathJax engine).
 */
export const MATH_STYLES_ID = 'virtual:vitepress-plugin-math.css'

const RESOLVED_STYLES_ID = '\0' + MATH_STYLES_ID
const FONT_URL = '/vpm-fonts/mathjax'

const JSDELIVR = 'https://cdn.jsdelivr.net/npm'

/** The upstream KaTeX stylesheet, exactly as `styles/katex.css` imports it. */
const KATEX_IMPORT_RE = /@import\s+(['"])katex\/dist\/katex\.min\.css\1\s*;/

interface VitePluginLike {
  name: string
  [hook: string]: unknown
}

/** The slice of a resolved Vite config that VitePress hangs its site config on. */
interface ResolvedConfigLike {
  vitepress?: { useWebFonts?: boolean }
}

/** Internal mutable view of the slice of a VitePress user config we touch. */
interface VitePressConfigLike {
  markdown?: {
    config?: (md: unknown) => unknown
  }
  vite?: {
    plugins?: unknown[]
  }
}

/** Where an installed package's fonts live locally, and which version they are. */
interface FontPackage {
  /** Absolute path of the package's `chtml/woff2` directory. */
  dir: string
  /** Installed version, pinned into the CDN URL so it can never drift. */
  version: string
}

function mathJaxFontPackage(): FontPackage | null {
  try {
    // Resolved through the mathjax package so the font version matches the
    // installed engine (the font package is mathjax's own dependency).
    const requireFromHere = createRequire(import.meta.url)
    const mathjaxPkg = requireFromHere.resolve('mathjax/package.json')
    const requireFromMathJax = createRequire(mathjaxPkg)
    const fontPkg = requireFromMathJax.resolve('@mathjax/mathjax-newcm-font/package.json')
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
    const { version } = createRequire(import.meta.url)('katex/package.json') as {
      version?: string
    }
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
  const path = id.replace(/\\/g, '/').replace(/[?#].*$/, '')
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

/**
 * Vite plugins serving the engine's runtime-generated stylesheet as
 * `virtual:vitepress-plugin-math.css`, plus the MathJax CHTML webfonts under
 * `/vpm-fonts/mathjax` (dev middleware + emitted build assets — self-hosted by
 * default). Pass the same renderer (or promise of one) that the markdown
 * plugin uses.
 *
 * Under VitePress's `useWebFonts` — on by default inside a webcontainer,
 * where serving font binaries is the expensive part — the MathJax and KaTeX
 * fonts come from jsDelivr instead, pinned to the installed versions, and
 * nothing local is served or emitted for them. Temml stays self-hosted either
 * way: its Latin Modern WOFF2 is vendored in this package, which is not yet on
 * npm, so there is no CDN copy to point at.
 *
 * Returns an array — the KaTeX stylesheet swap has to run `enforce: 'pre'`, so
 * it is its own plugin. Vite flattens nested arrays in `plugins`.
 */
export function mathStylesPlugin(renderer: PromiseLike<MathRenderer> | MathRenderer): unknown {
  let fontDir: string | null = null
  let needsFonts = false
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
        createRequire(import.meta.url).resolve('temml/package.json')
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
      const font = mathJaxFontPackage()
      if (webFonts && font) {
        return css.replaceAll(
          FONT_URL,
          `${JSDELIVR}/@mathjax/mathjax-newcm-font@${font.version}/chtml/woff2`,
        )
      }
      needsFonts = true
      fontDir = font?.dir ?? null
      return css
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
        const name = url.replace(/^\/+/, '').replace(/[?#].*$/, '')
        const dir = fontDir ?? mathJaxFontPackage()?.dir
        if (!dir || !/^[\w.-]+\.woff2$/.test(name)) return next()
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

      if (!needsFonts) return
      const dir = fontDir ?? mathJaxFontPackage()?.dir
      if (!dir) return
      const { readdir, readFile } = await import('node:fs/promises')
      const self = this as unknown as {
        emitFile(file: { type: 'asset'; fileName: string; source: Uint8Array }): void
      }
      for (const name of await readdir(dir)) {
        if (!name.endsWith('.woff2')) continue
        self.emitFile({
          type: 'asset',
          fileName: `${FONT_URL.slice(1)}/${name}`,
          source: await readFile(`${dir}/${name}`),
        })
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
 * One-stop VitePress wiring: resolves the engine eagerly, chains the
 * markdown-it plugin into `markdown.config`, and registers the Vite plugins
 * that serve engine CSS and MathJax webfonts — self-hosted, except under
 * VitePress's `useWebFonts` (see {@link mathStylesPlugin}).
 *
 * ```ts
 * // .vitepress/config.ts
 * import { defineConfig } from 'vitepress'
 * import { withMath } from 'vitepress-plugin-math'
 *
 * export default withMath(defineConfig({ ... }), { engine: 'temml' })
 * ```
 *
 * Style wiring stays explicit (one import in `.vitepress/theme/index.ts`):
 * `vitepress-plugin-math/styles/katex.css`, `…/styles/temml.css`, or
 * `virtual:vitepress-plugin-math.css` for MathJax.
 *
 * An engine that fails to resolve (package not installed, unknown name) does
 * not break config loading: the failure is rethrown the first time a page
 * renders math, so dev shows an error overlay and `vitepress build` fails.
 */
export function withMath<T extends object>(config: T, options: ApplyMathOptions = {}): T {
  // Eager: both the markdown hook and the Vite css loader await this, and
  // the theme (which imports the virtual css) may load before any markdown
  // is rendered.
  const renderer = resolveRenderer(options)
  // Nothing awaits this until markdown setup or the css load hook runs, so mark
  // a rejection handled here — an unhandled one in that window ends the
  // process. Both awaiters handle it themselves; every later `await renderer`
  // still sees it.
  renderer.catch(() => {})

  const cfg = config as VitePressConfigLike
  const markdown = (cfg.markdown ??= {})
  const userConfig = markdown.config
  markdown.config = async (md: unknown) => {
    // A resolution failure must not escape this hook: VitePress runs it while
    // constructing the dev server, including on a config-reload restart, where
    // a throw takes the process down. The parsing rules register either way,
    // and the failure is rethrown per expression at render time — a dev error
    // overlay with the server alive, a hard failure during `vitepress build`.
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

  const vite = (cfg.vite ??= {})
  ;(vite.plugins ??= []).push(mathStylesPlugin(renderer))

  return config
}
