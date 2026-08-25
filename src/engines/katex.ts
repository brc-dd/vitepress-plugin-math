/// <reference path="./engine-shims.d.ts" />
import type { KatexOptions } from 'katex'
import type { MathRenderer } from '../types.ts'
import { loadEngine } from './shared.ts'

export interface KatexRendererOptions {
  /**
   * Options forwarded to `katex.renderToString`. `displayMode` is set per
   * expression by the plugin. Defaults applied first: `throwOnError: false`.
   */
  katex?: Omit<KatexOptions, 'displayMode'>
  /**
   * Load the mhchem extension (`\ce`, `\pu`) at build time.
   * @default true
   */
  mhchem?: boolean
}

/** KaTeX adapter: sync, stateless, HTML + hidden MathML output by default. */
export async function createKatexRenderer(
  options: KatexRendererOptions = {},
): Promise<MathRenderer> {
  const { default: katex } = await loadEngine('katex', 'katex', () => import('katex'))
  if (options.mhchem !== false) {
    await loadEngine('katex', 'katex', () => import('katex/contrib/mhchem'))
  }
  const base: KatexOptions = { throwOnError: false, ...options.katex }
  return {
    name: 'katex',
    render: (tex, ctx) => katex.renderToString(tex, { ...base, displayMode: ctx.display }),
  }
}
