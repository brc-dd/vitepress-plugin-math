import { createRequire } from 'node:module'
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

interface VitePluginLike {
  name: string
  [hook: string]: unknown
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

function mathJaxFontDir(): string | null {
  try {
    // Resolved through the mathjax package so the font version matches the
    // installed engine (the font package is mathjax's own dependency).
    const requireFromHere = createRequire(import.meta.url)
    const mathjaxPkg = requireFromHere.resolve('mathjax/package.json')
    const requireFromMathJax = createRequire(mathjaxPkg)
    const fontPkg = requireFromMathJax.resolve('@mathjax/mathjax-newcm-font/package.json')
    return fontPkg.replace(/package\.json$/, 'chtml/woff2')
  } catch {
    return null
  }
}

/**
 * Vite plugin serving the engine's runtime-generated stylesheet as
 * `virtual:vitepress-plugin-math.css`, plus the MathJax CHTML webfonts under
 * `/vpm-fonts/mathjax` (dev middleware + emitted build assets — self-hosted,
 * no CDN). Pass the same renderer (or promise of one) that the markdown
 * plugin uses.
 */
export function mathStylesPlugin(renderer: PromiseLike<MathRenderer> | MathRenderer): unknown {
  let fontDir: string | null = null
  let needsFonts = false

  return {
    name: 'vitepress-plugin-math:styles',

    resolveId(id: string) {
      if (id === MATH_STYLES_ID) return RESOLVED_STYLES_ID
      return undefined
    },

    async load(id: string) {
      if (id !== RESOLVED_STYLES_ID) return undefined
      const resolved = await renderer
      const css = resolved.stylesheet?.() ?? ''
      needsFonts = css.includes(FONT_URL)
      if (needsFonts) fontDir = mathJaxFontDir()
      return css
    },

    async configureServer(server: {
      middlewares: {
        use(path: string, handler: (req: unknown, res: unknown, next: () => void) => void): void
      }
    }) {
      const { readFile } = await import('node:fs/promises')
      server.middlewares.use(FONT_URL, (req, res, next) => {
        const url = (req as { url?: string }).url ?? ''
        const name = url.replace(/^\/+/, '').replace(/[?#].*$/, '')
        const dir = fontDir ?? mathJaxFontDir()
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
      const dir = fontDir ?? mathJaxFontDir()
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
}

/**
 * One-stop VitePress wiring: resolves the engine eagerly, chains the
 * markdown-it plugin into `markdown.config`, and registers the Vite plugin
 * that serves engine CSS (and MathJax webfonts) — no CDN anywhere.
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
 */
export function withMath<T extends object>(config: T, options: ApplyMathOptions = {}): T {
  // Eager: both the markdown hook and the Vite css loader await this, and
  // the theme (which imports the virtual css) may load before any markdown
  // is rendered.
  const renderer = resolveRenderer(options)

  const cfg = config as VitePressConfigLike
  const markdown = (cfg.markdown ??= {})
  const userConfig = markdown.config
  markdown.config = async (md: unknown) => {
    mathPlugin(md as MathMarkdownIt, { ...options, renderer: await renderer })
    await userConfig?.(md)
  }

  const vite = (cfg.vite ??= {})
  ;(vite.plugins ??= []).push(mathStylesPlugin(renderer))

  return config
}
