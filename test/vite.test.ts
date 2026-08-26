import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import type { MathRenderer } from '../src/types.ts'
import { MATH_STYLES_ID, mathStylesPlugin } from '../src/vite/index.ts'

const RESOLVED_STYLES_ID = '\0' + MATH_STYLES_ID

/** One `\@font-face` in the shape MathJax's CHTML output emits it. */
const MATHJAX_CSS =
  '@font-face { font-family: MJX-ncm; src: url("/vpm-fonts/mathjax/mjx-ncm-ar.woff2") format("woff2"); }'

const KATEX_CSS = "@import 'katex/dist/katex.min.css';\n@import './core.css';\n"

const OWN_KATEX_CSS_ID = fileURLToPath(new URL('../src/styles/katex.css', import.meta.url))
const INSTALLED_KATEX_CSS_ID =
  '/site/node_modules/vitepress-plugin-math/dist/styles/katex.css?used&lang.css'

const require_ = createRequire(import.meta.url)
const katexVersion = (require_('katex/package.json') as { version: string }).version
const mathJaxFontVersion = (
  createRequire(require_.resolve('mathjax/package.json'))(
    '@mathjax/mathjax-newcm-font/package.json',
  ) as { version: string }
).version

interface EmitContext {
  emitFile(file: { type: 'asset'; fileName: string; source: Uint8Array }): void
}

/** The hooks these tests drive, on plugin objects the factory types `unknown`. */
interface KatexCdnPlugin {
  name: string
  enforce: string
  transform(code: string, id: string): { code: string; map: null } | undefined
}

interface StylesPlugin {
  name: string
  configResolved(config: unknown): void
  load(id: string): Promise<string | undefined>
  configureServer(server: unknown): Promise<void>
  generateBundle(
    this: EmitContext,
    options: unknown,
    bundle: Record<string, unknown>,
  ): Promise<void>
}

function stubRenderer(css: string): MathRenderer {
  return { name: 'stub', render: () => '', stylesheet: () => css }
}

/** Both plugins the factory returns, with the hooks under test typed. */
function plugins(css = MATHJAX_CSS): [KatexCdnPlugin, StylesPlugin] {
  return mathStylesPlugin(stubRenderer(css)) as [KatexCdnPlugin, StylesPlugin]
}

/** Resolve the factory's plugins with a given VitePress `useWebFonts`. */
function resolved(useWebFonts?: boolean, css = MATHJAX_CSS): [KatexCdnPlugin, StylesPlugin] {
  const pair = plugins(css)
  pair[1].configResolved(useWebFonts === undefined ? {} : { vitepress: { useWebFonts } })
  return pair
}

afterEach(() => {
  delete process.versions['webcontainer']
})

describe('mathStylesPlugin shape', () => {
  it('returns the pre-ordered KaTeX plugin alongside the styles plugin', () => {
    const [katex, styles] = plugins()
    expect(katex.name).toBe('vitepress-plugin-math:katex-cdn')
    expect(katex.enforce).toBe('pre')
    expect(styles.name).toBe('vitepress-plugin-math:styles')
  })
})

describe('web-font detection', () => {
  it('follows VitePress when it resolved the option', async () => {
    const [, styles] = resolved(true)
    await expect(styles.load(RESOLVED_STYLES_ID)).resolves.not.toContain('/vpm-fonts/')
    const [, off] = resolved(false)
    await expect(off.load(RESOLVED_STYLES_ID)).resolves.toContain('/vpm-fonts/')
  })

  it('falls back to the webcontainer probe outside VitePress', async () => {
    // An explicit `false` from VitePress still wins over a live probe.
    process.versions['webcontainer'] = '1.2.3'
    const [, off] = resolved(false)
    await expect(off.load(RESOLVED_STYLES_ID)).resolves.toContain('/vpm-fonts/')
    const [, probed] = resolved(undefined)
    await expect(probed.load(RESOLVED_STYLES_ID)).resolves.not.toContain('/vpm-fonts/')
  })

  it('self-hosts in a plain Node process', async () => {
    const [, styles] = resolved(undefined)
    await expect(styles.load(RESOLVED_STYLES_ID)).resolves.toContain('/vpm-fonts/')
  })
})

describe('MathJax CHTML fonts', () => {
  it('rewrites the local prefix to the pinned font package on jsDelivr', async () => {
    const [, styles] = resolved(true)
    await expect(styles.load(RESOLVED_STYLES_ID)).resolves.toContain(
      `url("https://cdn.jsdelivr.net/npm/@mathjax/mathjax-newcm-font@${mathJaxFontVersion}/chtml/woff2/mjx-ncm-ar.woff2")`,
    )
  })

  it('leaves a stylesheet without font URLs alone', async () => {
    const [, styles] = resolved(true, 'mjx-container { display: inline; }')
    await expect(styles.load(RESOLVED_STYLES_ID)).resolves.toBe(
      'mjx-container { display: inline; }',
    )
  })

  it('ignores every id but the virtual stylesheet', async () => {
    const [, styles] = resolved(true)
    await expect(styles.load(MATH_STYLES_ID)).resolves.toBeUndefined()
  })

  it('skips the dev middleware when the fonts come from the CDN', async () => {
    const paths: string[] = []
    const server = { middlewares: { use: (path: string) => void paths.push(path) } }
    const [, styles] = resolved(true)
    await styles.configureServer(server)
    expect(paths).toEqual([])
    const [, off] = resolved(false)
    await off.configureServer(server)
    expect(paths).toEqual(['/vpm-fonts/mathjax'])
  })

  it('emits no local woff2 when the fonts come from the CDN', async () => {
    const emitted: string[] = []
    const ctx: EmitContext = { emitFile: (file) => void emitted.push(file.fileName) }
    const [, styles] = resolved(true)
    await styles.load(RESOLVED_STYLES_ID)
    await styles.generateBundle.call(ctx, {}, {})
    expect(emitted).toEqual([])
  })

  it('still emits them when self-hosting', async () => {
    const emitted: string[] = []
    const ctx: EmitContext = { emitFile: (file) => void emitted.push(file.fileName) }
    const [, styles] = resolved(false)
    await styles.load(RESOLVED_STYLES_ID)
    await styles.generateBundle.call(ctx, {}, {})
    expect(emitted.length).toBeGreaterThan(0)
    expect(emitted.every((name) => /^vpm-fonts\/mathjax\/[\w.-]+\.woff2$/.test(name))).toBe(true)
  })
})

describe('KaTeX stylesheet swap', () => {
  const cdnImport = `@import url('https://cdn.jsdelivr.net/npm/katex@${katexVersion}/dist/katex.min.css');`

  it('points our style entry at the pinned upstream stylesheet on jsDelivr', () => {
    const [katex] = resolved(true)
    expect(katex.transform(KATEX_CSS, OWN_KATEX_CSS_ID)?.code).toBe(
      `${cdnImport}\n@import './core.css';\n`,
    )
  })

  it('matches the style entry as an installed dependency too', () => {
    const [katex] = resolved(true)
    expect(katex.transform(KATEX_CSS, INSTALLED_KATEX_CSS_ID)?.code).toContain(cdnImport)
  })

  it('leaves the import alone when self-hosting', () => {
    const [katex] = resolved(false)
    expect(katex.transform(KATEX_CSS, OWN_KATEX_CSS_ID)).toBeUndefined()
  })

  it("leaves someone else's katex.css alone", () => {
    const [katex] = resolved(true)
    expect(katex.transform(KATEX_CSS, '/site/theme/styles/katex.css')).toBeUndefined()
  })

  it('leaves a style entry that no longer imports upstream alone', () => {
    const [katex] = resolved(true)
    expect(katex.transform("@import './core.css';", OWN_KATEX_CSS_ID)).toBeUndefined()
  })

  it('pins a concrete version, never a floating tag', () => {
    const [katex] = resolved(true)
    const code = katex.transform(KATEX_CSS, OWN_KATEX_CSS_ID)?.code ?? ''
    expect(code).toMatch(/katex@\d+\.\d+\.\d+\/dist\/katex\.min\.css/)
  })
})
