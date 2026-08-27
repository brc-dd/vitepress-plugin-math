import type { KatexRendererOptions } from './engines/katex.ts'
import type { MathJaxRendererOptions } from './engines/mathjax.ts'
import { EngineMissingError } from './engines/shared.ts'
import type { TemmlRendererOptions } from './engines/temml.ts'
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

/** The per-engine option bags, one per engine that takes options. */
interface EngineOptionBags {
  /** MathJax adapter options (`engines/mathjax` exports the same type). */
  mathjax?: MathJaxRendererOptions
  /** KaTeX adapter options (`engines/katex` exports the same type). */
  katex?: KatexRendererOptions
  /** Temml adapter options (`engines/temml` exports the same type). */
  temml?: TemmlRendererOptions
}

/** What the Vite plugin injects on its own, over and above the parsing. */
interface InjectionOptions {
  /**
   * Serve the site's theme entry wrapped in a module that imports the
   * engine's stylesheets and starts the client composables (`useCopyTex()`,
   * and `useTemmlRefs()` under Temml) — the whole point of `math()` needing
   * no theme file. Turn it off to wire those yourself.
   * @default true
   */
  inject?: boolean
  /**
   * Import the engine's stylesheets into that wrapper. Turning this off
   * keeps the composables and leaves the styles to you — one import of
   * `vitepress-plugin-math/styles/katex.css`, `…/styles/temml.css`, or
   * `virtual:vitepress-plugin-math.css` for MathJax.
   * @default true
   */
  styles?: boolean
}

/**
 * Parser options plus the engine choice and that engine's own option bag —
 * picking an `engine` narrows the accepted bag to the matching one, so editor
 * completion offers exactly the options that apply. `inject` and `styles`
 * steer the Vite plugin rather than the parsing, and are ignored by
 * {@link applyMath}.
 *
 * The bag types come from the engine adapters, which type against the optional
 * engine packages. Projects that turn `skipLibCheck` off therefore need the
 * configured engine installed to typecheck.
 */
export type ApplyMathOptions = MathOptions &
  InjectionOptions &
  (
    | ({
        /**
         * No engine set — the first installed engine wins in `ENGINE_PRIORITY`
         * order (mathjax → katex → temml → webc), so any bag may apply.
         */
        engine?: undefined
      } & EngineOptionBags)
    | ({
        /** MathJax: SVG output, runtime-generated CSS, self-hosted webfonts. */
        engine: 'mathjax'
      } & Pick<EngineOptionBags, 'mathjax'>)
    | ({
        /** KaTeX: HTML + hidden MathML; import `…/styles/katex.css`. */
        engine: 'katex'
      } & Pick<EngineOptionBags, 'katex'>)
    | ({
        /** Temml: MathML only; import `…/styles/temml.css`. */
        engine: 'temml'
      } & Pick<EngineOptionBags, 'temml'>)
    | {
        /** \@webc.site/math: MathML only, and it takes no options. */
        engine: 'webc'
      }
    | {
        /** A custom `MathRenderer`, used as-is. */
        engine: MathRenderer
      }
  )

/** Reads a bag off the union, which hides the ones the branch does not name. */
const bags = (o: ApplyMathOptions): EngineOptionBags => o as MathOptions & EngineOptionBags

const loaders: Record<MathEngineName, (options: ApplyMathOptions) => Promise<MathRenderer>> = {
  mathjax: async (o) =>
    (await import('./engines/mathjax.ts')).createMathJaxRenderer(bags(o).mathjax),
  katex: async (o) => (await import('./engines/katex.ts')).createKatexRenderer(bags(o).katex),
  temml: async (o) => (await import('./engines/temml.ts')).createTemmlRenderer(bags(o).temml),
  webc: async () => (await import('./engines/webc.ts')).createWebcMathRenderer(),
}

/**
 * Resolves the engine renderer for the given options: an explicit
 * `MathRenderer` is used as-is, a named engine is loaded (throwing
 * `EngineMissingError` with an install hint when its package is absent, and a
 * name-listing error when the name is not one we know), and with no `engine`
 * the first installed one wins in `ENGINE_PRIORITY` order.
 */
export async function resolveRenderer(options: ApplyMathOptions = {}): Promise<MathRenderer> {
  const { engine } = options
  if (engine !== undefined && typeof engine !== 'string') return engine
  if (engine !== undefined) {
    const load = loaders[engine as MathEngineName] as
      ((options: ApplyMathOptions) => Promise<MathRenderer>) | undefined
    if (!load) {
      throw new Error(
        `[vitepress-plugin-math] Unknown engine '${String(engine)}'. Expected ` +
          `'mathjax', 'katex', 'temml', 'webc', or a MathRenderer object.`,
      )
    }
    return load(options)
  }
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
