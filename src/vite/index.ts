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

/** Minimal structural slice of a VitePress user config that we touch. */
export interface VitePressConfigLike {
  markdown?: {
    config?: (md: never) => unknown
    [key: string]: unknown
  }
  vite?: {
    plugins?: unknown[]
    [key: string]: unknown
  }
  [key: string]: unknown
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

    async generateBundle() {
      if (!needsFonts) return
      const dir = fontDir ?? mathJaxFontDir()
      if (!dir) return
      const { readdir, readFile } = await import('node:fs/promises')
      const self = this as {
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
export function withMath<T extends VitePressConfigLike>(
  config: T,
  options: ApplyMathOptions = {},
): T {
  // Eager: both the markdown hook and the Vite css loader await this, and
  // the theme (which imports the virtual css) may load before any markdown
  // is rendered.
  const renderer = resolveRenderer(options)

  const markdown = (config.markdown ??= {})
  const userConfig = markdown.config as ((md: unknown) => unknown) | undefined
  markdown.config = async (md: unknown) => {
    mathPlugin(md as MathMarkdownIt, { ...options, renderer: await renderer })
    await userConfig?.(md)
  }

  const vite = (config.vite ??= {})
  ;(vite.plugins ??= []).push(mathStylesPlugin(renderer))

  return config
}
