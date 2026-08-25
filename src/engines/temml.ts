import type { Options as TemmlOptions } from 'temml'
import type { MathRenderer } from '../types.ts'
import { loadEngine } from './shared.ts'

export interface TemmlRendererOptions {
  /**
   * Options forwarded to `temml.renderToString`. `displayMode` is set per
   * expression and `macros` is re-created per page (so `\gdef` cannot leak
   * across pages — pass starting macros here). Defaults applied first:
   * `throwOnError: false`.
   */
  temml?: Omit<TemmlOptions, 'displayMode'>
}

/** Temml adapter: sync, MathML-only output — the smallest markup by far. */
export async function createTemmlRenderer(
  options: TemmlRendererOptions = {},
): Promise<MathRenderer> {
  const { default: temml } = await loadEngine('temml', 'temml', () => import('temml'))
  const base: TemmlOptions = { throwOnError: false, ...options.temml }
  const baseMacros = base.macros
  let macros = { ...baseMacros }
  return {
    name: 'temml',
    render: (tex, ctx) => temml.renderToString(tex, { ...base, displayMode: ctx.display, macros }),
    reset: () => {
      macros = { ...baseMacros }
    },
  }
}
