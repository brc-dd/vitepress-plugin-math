import type { MathRenderer } from '../types.ts'
import { loadEngine } from './shared.ts'

/**
 * \@webc.site/math adapter: a minimum-payload TeX → MathML converter.
 *
 * Caveats (by upstream design): thin TeX coverage (no `\color`, `\binom`,
 * physics/mhchem, …), unsupported commands throw raw arrays (surfaced through
 * the plugin's error placeholder), and its output uses legacy `mathvariant`
 * values that MathML Core ignores. Prefer Temml for full-fidelity MathML.
 */
export async function createWebcMathRenderer(): Promise<MathRenderer> {
  const { default: mathml } = await loadEngine(
    'webc',
    '@webc.site/math',
    () => import('@webc.site/math'),
  )
  return {
    name: 'webc',
    render: (tex, ctx) => mathml(tex, ctx.display),
  }
}
