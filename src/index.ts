import { EngineMissingError } from './engines/shared.ts'
import { mathPlugin } from './plugin.ts'
import type { MathMarkdownIt, MathOptions, MathRenderer } from './types.ts'

export { mathPlugin } from './plugin.ts'
export { EngineMissingError } from './engines/shared.ts'
export type {
  MathDelimiters,
  MathEnv,
  MathOptions,
  MathPluginOptions,
  MathRenderContext,
  MathRenderer,
} from './types.ts'

export type MathEngineName = 'mathjax' | 'katex' | 'temml' | 'webc'

/** Auto-detection priority when no engine is configured. */
export const ENGINE_PRIORITY: readonly MathEngineName[] = ['mathjax', 'katex', 'temml', 'webc']

export interface ApplyMathOptions extends MathOptions {
  /**
   * Which engine to use: a name (its package must be installed), or a custom
   * `MathRenderer`. When omitted, the first installed engine wins, in
   * `ENGINE_PRIORITY` order (mathjax → katex → temml → webc).
   */
  engine?: MathEngineName | MathRenderer
  /**
   * MathJax adapter options — import `vitepress-plugin-math/engines/mathjax`
   * for the precise `MathJaxRendererOptions` type.
   */
  mathjax?: Record<string, unknown>
  /** KaTeX adapter options (`engines/katex` has the precise type). */
  katex?: Record<string, unknown>
  /** Temml adapter options (`engines/temml` has the precise type). */
  temml?: Record<string, unknown>
  /** \@webc.site/math adapter options (none yet). */
  webc?: Record<string, unknown>
}

const loaders: Record<MathEngineName, (options: ApplyMathOptions) => Promise<MathRenderer>> = {
  mathjax: async (o) =>
    (await import('./engines/mathjax.ts')).createMathJaxRenderer(
      o.mathjax as import('./engines/mathjax.ts').MathJaxRendererOptions | undefined,
    ),
  katex: async (o) =>
    (await import('./engines/katex.ts')).createKatexRenderer(
      o.katex as import('./engines/katex.ts').KatexRendererOptions | undefined,
    ),
  temml: async (o) =>
    (await import('./engines/temml.ts')).createTemmlRenderer(
      o.temml as import('./engines/temml.ts').TemmlRendererOptions | undefined,
    ),
  webc: async () => (await import('./engines/webc.ts')).createWebcMathRenderer(),
}

/**
 * Resolves the engine renderer for the given options: an explicit
 * `MathRenderer` is used as-is, a named engine is loaded (throwing
 * `EngineMissingError` with an install hint when its package is absent), and
 * with no `engine` the first installed one wins in `ENGINE_PRIORITY` order.
 */
export async function resolveRenderer(options: ApplyMathOptions = {}): Promise<MathRenderer> {
  const { engine } = options
  if (engine !== undefined && typeof engine !== 'string') return engine
  if (engine !== undefined) return loaders[engine](options)
  for (const name of ENGINE_PRIORITY) {
    try {
      return await loaders[name](options)
    } catch (error) {
      if (error instanceof EngineMissingError) continue
      throw error
    }
  }
  throw new Error(
    '[vitepress-plugin-math] No math engine found. Install one of `mathjax`, `katex`, ' +
      '`temml`, or `@webc.site/math` (e.g. `pnpm add -D katex`), or pass a custom renderer.',
  )
}

/**
 * One-call setup: resolves the engine, then installs the markdown-it plugin.
 * Returns the resolved renderer (its `stylesheet()`/`finalize()` are useful
 * for custom integrations).
 *
 * ```ts
 * // .vitepress/config.ts
 * import { defineConfig } from 'vitepress'
 * import { applyMath } from 'vitepress-plugin-math'
 *
 * export default defineConfig({
 *   markdown: { config: (md) => applyMath(md) },
 * })
 * ```
 */
export async function applyMath(
  md: MathMarkdownIt,
  options: ApplyMathOptions = {},
): Promise<MathRenderer> {
  const renderer = await resolveRenderer(options)
  mathPlugin(md, { ...options, renderer })
  return renderer
}
