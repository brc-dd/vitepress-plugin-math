import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import MarkdownIt from 'markdown-it'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import type { ApplyMathOptions } from '../src/index.ts'
import type { MathRenderer } from '../src/types.ts'
import { MATH_STYLES_ID, math, mathStylesPlugin, withMath } from '../src/vite/index.ts'
import { createProbeRenderer } from './helpers.ts'

const RESOLVED_STYLES_ID = '\0' + MATH_STYLES_ID

/** One `\@font-face` per font package, in the shape MathJax's CHTML emits. */
const fontFace = (pkg: string, file: string): string =>
  `@font-face { src: url("/vpm-fonts/mathjax/${pkg}/${file}.woff2") format("woff2"); }`

const MATHJAX_CSS = fontFace('mathjax-newcm-font', 'mjx-ncm-ar')
/** What a page using `\ce{…}` produces: the main font plus a font extension. */
const MATHJAX_CSS_WITH_EXTENSION = `${MATHJAX_CSS}\n${fontFace('mathjax-mhchem-font-extension', 'mjx-mhc-m')}`

const KATEX_CSS = "@import 'katex/dist/katex.min.css';\n@import './core.css';\n"

const OWN_KATEX_CSS_ID = fileURLToPath(new URL('../src/styles/katex.css', import.meta.url))
const INSTALLED_KATEX_CSS_ID =
  '/site/node_modules/vitepress-plugin-math/dist/styles/katex.css?used&lang.css'

const require_ = createRequire(import.meta.url)
const katexVersion = (require_('katex/package.json') as { version: string }).version
const requireFromMathJax = createRequire(require_.resolve('mathjax/package.json'))
const fontVersion = (pkg: string): string =>
  (requireFromMathJax(`@mathjax/${pkg}/package.json`) as { version: string }).version

interface EmitContext {
  emitFile(file: { type: 'asset'; fileName: string; source: Uint8Array }): void
}

/** The one middleware signature the styles plugin registers. */
type FontHandler = (req: unknown, res: unknown, next: () => void) => void

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
      `url("https://cdn.jsdelivr.net/npm/@mathjax/mathjax-newcm-font@${fontVersion('mathjax-newcm-font')}/chtml/woff2/mjx-ncm-ar.woff2")`,
    )
  })

  it('pins each font package to its own installed version', async () => {
    const [, styles] = resolved(true, MATHJAX_CSS_WITH_EXTENSION)
    const css = (await styles.load(RESOLVED_STYLES_ID)) ?? ''
    for (const pkg of ['mathjax-newcm-font', 'mathjax-mhchem-font-extension']) {
      expect(css).toContain(`https://cdn.jsdelivr.net/npm/@mathjax/${pkg}@${fontVersion(pkg)}/`)
    }
    expect(css).not.toContain('/vpm-fonts/')
  })

  it('leaves a font package it cannot resolve self-hosted', async () => {
    const [, styles] = resolved(true, fontFace('mathjax-nonexistent-font', 'mjx-nope'))
    await expect(styles.load(RESOLVED_STYLES_ID)).resolves.toContain(
      '/vpm-fonts/mathjax/mathjax-nonexistent-font/mjx-nope.woff2',
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
    expect(
      emitted.every((name) =>
        /^vpm-fonts\/mathjax\/mathjax-newcm-font\/[\w.-]+\.woff2$/.test(name),
      ),
    ).toBe(true)
  })

  it('emits one directory per font package the stylesheet names', async () => {
    const emitted: string[] = []
    const ctx: EmitContext = { emitFile: (file) => void emitted.push(file.fileName) }
    const [, styles] = resolved(false, MATHJAX_CSS_WITH_EXTENSION)
    await styles.load(RESOLVED_STYLES_ID)
    await styles.generateBundle.call(ctx, {}, {})
    // Whole directories, not the stylesheet's reference list: upstream names
    // a few files it does not ship.
    expect(emitted).toContain('vpm-fonts/mathjax/mathjax-mhchem-font-extension/mjx-mhc-m.woff2')
    expect(emitted).toContain('vpm-fonts/mathjax/mathjax-mhchem-font-extension/mjx-mhc-n.woff2')
    expect(emitted.some((name) => name.startsWith('vpm-fonts/mathjax/mathjax-newcm-font/'))).toBe(
      true,
    )
  })

  it('emits nothing for a font package that is not installed', async () => {
    const emitted: string[] = []
    const ctx: EmitContext = { emitFile: (file) => void emitted.push(file.fileName) }
    const [, styles] = resolved(false, fontFace('mathjax-nonexistent-font', 'mjx-nope'))
    await styles.load(RESOLVED_STYLES_ID)
    await styles.generateBundle.call(ctx, {}, {})
    expect(emitted).toEqual([])
  })
})

describe('MathJax font middleware', () => {
  /** Registers the middleware and hands back the one handler it mounted. */
  async function handler(): Promise<FontHandler> {
    let mounted: FontHandler | undefined
    const [, styles] = resolved(false)
    await styles.configureServer({
      middlewares: { use: (_path: string, fn: FontHandler) => void (mounted = fn) },
    })
    if (!mounted) throw new Error('no middleware registered')
    return mounted
  }

  /** Drives one request, resolving to the served bytes or `'next'`. */
  function request(fn: FontHandler, url: string): Promise<Uint8Array | 'next'> {
    return new Promise((resolve) => {
      fn({ url }, { setHeader: () => {}, end: (data: Uint8Array) => resolve(data) }, () =>
        resolve('next'),
      )
    })
  }

  it('serves a file out of the named font package', async () => {
    const fn = await handler()
    const data = await request(fn, '/mathjax-newcm-font/mjx-ncm-lr.woff2?v=1')
    expect(data).not.toBe('next')
    expect((data as Uint8Array).length).toBeGreaterThan(0)
  })

  it('serves the font extensions from their own directory', async () => {
    const fn = await handler()
    const data = await request(fn, '/mathjax-mhchem-font-extension/mjx-mhc-m.woff2')
    expect(data).not.toBe('next')
  })

  it.each([
    '/mjx-ncm-lr.woff2',
    '/mathjax-newcm-font/mjx-ncm-lr.woff',
    '/mathjax-newcm-font/nested/mjx-ncm-lr.woff2',
    '/mathjax-nonexistent-font/mjx-nope.woff2',
    '/mathjax-newcm-font/missing.woff2',
  ])('passes %s on to the next handler', async (url) => {
    expect(await request(await handler(), url)).toBe('next')
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

/** The injector's hooks, on plugin objects the factory types structurally. */
interface InjectPlugin {
  name: string
  enforce: string
  configResolved(config: unknown): void
  resolveId(source: string): string | undefined
  load(id: string): Promise<string | undefined>
}

/** The slice of a VitePress site config the injector reads and writes. */
interface SiteStub {
  themeDir?: string
  markdown?: { config?: (md: unknown) => unknown }
}

const themeDirs: string[] = []

/** A throwaway theme directory holding the given entry files. */
function fakeThemeDir(...files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'vpm-theme-'))
  themeDirs.push(dir)
  for (const file of files) writeFileSync(join(dir, file), 'export default {}\n')
  return dir
}

afterAll(() => {
  for (const dir of themeDirs) rmSync(dir, { recursive: true, force: true })
})

/** Plugin names in the order the factory returns them. */
function names(plugins: { name: string }[]): string[] {
  return plugins.map((plugin) => plugin.name)
}

/** The injector out of a full plugin set, with the hooks under test typed. */
function injector(options: ApplyMathOptions): InjectPlugin {
  return math(options)[0] as InjectPlugin
}

/** An injector that has already seen the given site config. */
function mounted(options: ApplyMathOptions, site: SiteStub = {}): InjectPlugin {
  const plugin = injector(options)
  plugin.configResolved({ vitepress: site })
  return plugin
}

/** Options naming an engine that resolves to a renderer with the given name. */
function engine(name: string): ApplyMathOptions {
  return { engine: createProbeRenderer(name) }
}

describe('math() plugin set', () => {
  it('adds the injector to the styles pair', () => {
    expect(names(math(engine('probe')))).toEqual([
      'vitepress-plugin-math:inject',
      'vitepress-plugin-math:katex-cdn',
      'vitepress-plugin-math:styles',
    ])
  })

  it('drops the injector under `inject: false`', () => {
    expect(names(math({ ...engine('probe'), inject: false }))).toEqual([
      'vitepress-plugin-math:katex-cdn',
      'vitepress-plugin-math:styles',
    ])
  })

  it('orders the injector ahead of VitePress, which reads the config it writes', () => {
    expect(injector(engine('probe')).enforce).toBe('pre')
  })
})

describe('markdown wiring', () => {
  it('refuses to run outside VitePress', () => {
    expect(() => injector(engine('probe')).configResolved({})).toThrow(/must run inside VitePress/)
  })

  it('chains onto a site config that has no markdown options at all', async () => {
    const site: SiteStub = {}
    mounted(engine('probe'), site)
    await site.markdown?.config?.(new MarkdownIt())
    const md = new MarkdownIt()
    await site.markdown?.config?.(md)
    expect(md.render('$x$')).toContain('[I:x]')
  })

  it('registers ahead of the config hook that was already there', async () => {
    const seen: string[] = []
    const site: SiteStub = {
      markdown: { config: (md) => void seen.push((md as MarkdownIt).render('$x$')) },
    }
    mounted(engine('probe'), site)
    await site.markdown?.config?.(new MarkdownIt())
    expect(seen[0]).toContain('[I:x]')
  })

  it('leaves markdown options a second plugin already chained alone', () => {
    const site: SiteStub = {}
    mounted(engine('one'), site)
    const chained = site.markdown?.config
    mounted(engine('two'), site)
    expect(site.markdown?.config).toBe(chained)
  })

  it('registers the rules even when the engine failed to resolve', async () => {
    const site: SiteStub = {}
    mounted({ engine: 'nope' } as unknown as ApplyMathOptions, site)
    const md = new MarkdownIt()
    // The hook itself survives — VitePress builds the dev server around it —
    // and the failure is rethrown per expression instead, at render time.
    await expect(site.markdown?.config?.(md)).resolves.not.toThrow()
    expect(() => md.render('$x$')).toThrow(/Unknown engine/)
  })
})

describe('theme wrapper', () => {
  it('serves the wrapper for the theme entry, whatever dev appends to the id', async () => {
    const dir = fakeThemeDir('index.ts')
    const plugin = mounted(engine('probe'), { themeDir: dir })
    const entry = JSON.stringify(`${dir}/index.ts?vpm-real`)
    for (const id of [`${dir}/index.ts`, `${dir}/index.ts?v=abc`, `${dir}/index.ts?t=1#x`]) {
      const code = (await plugin.load(id)) ?? ''
      expect(code).toContain(`import Theme from ${entry}`)
      expect(code).toContain(`export * from ${entry}`)
      expect(code).toContain('...Theme,')
      expect(code).toContain('useCopyTex()')
    }
  })

  it('hands the marked id back to Vite, which loads the real file', async () => {
    const dir = fakeThemeDir('index.ts')
    const plugin = mounted(engine('probe'), { themeDir: dir })
    const source = `${dir}/index.ts?vpm-real`
    expect(plugin.resolveId(source)).toBe(source)
    expect(plugin.resolveId(`${dir}/index.ts`)).toBeUndefined()
    await expect(plugin.load(source)).resolves.toBeUndefined()
    await expect(plugin.load(`${source}&t=1`)).resolves.toBeUndefined()
  })

  it('runs whatever setup the theme already had', async () => {
    const dir = fakeThemeDir('index.ts')
    const plugin = mounted(engine('probe'), { themeDir: dir })
    // Resolved the way VitePress resolves `extends`: outermost `setup` wins.
    expect(await plugin.load(`${dir}/index.ts`)).toContain('inherited(Theme)?.()')
  })

  it('prefers the entry extension VitePress would resolve to', async () => {
    const dir = fakeThemeDir('index.js', 'index.ts')
    const plugin = mounted(engine('probe'), { themeDir: dir })
    expect(await plugin.load(`${dir}/index.ts`)).toContain('vpm-real')
    expect(await plugin.load(`${dir}/index.js`)).toBeUndefined()
  })

  it('falls back to the default theme when the site has no entry of its own', async () => {
    const plugin = mounted(engine('probe'), { themeDir: fakeThemeDir() })
    const entry = require_.resolve('vitepress/theme')
    expect(await plugin.load(entry)).toContain(JSON.stringify(`${entry}?vpm-real`))
  })

  it('leaves every other module alone', async () => {
    const dir = fakeThemeDir('index.ts')
    const plugin = mounted(engine('probe'), { themeDir: dir })
    await expect(plugin.load(`${dir}/other.ts`)).resolves.toBeUndefined()
    await expect(plugin.load('/elsewhere/index.ts')).resolves.toBeUndefined()
  })

  it('does nothing until VitePress has reported a theme directory', async () => {
    const plugin = mounted(engine('probe'), {})
    await expect(plugin.load('/anything/index.ts')).resolves.toBeUndefined()
  })
})

describe('theme wrapper styles', () => {
  /** The wrapper the injector generates for a site using the given engine. */
  async function wrapper(options: ApplyMathOptions): Promise<string> {
    const dir = fakeThemeDir('index.ts')
    return (await mounted(options, { themeDir: dir }).load(`${dir}/index.ts`)) ?? ''
  }

  it('imports the runtime stylesheet and the wrapper styles under MathJax', async () => {
    const code = await wrapper(engine('mathjax'))
    expect(code).toContain(`import ${JSON.stringify(MATH_STYLES_ID)}`)
    expect(code).toMatch(/import "[^"]+\/styles\/core\.css"/)
  })

  it.each([
    ['katex', 'katex.css'],
    ['temml', 'temml.css'],
    // MathML output either way, so both want the same math-font stack.
    ['webc', 'temml.css'],
  ])('imports the %s style entry', async (name, file) => {
    const code = await wrapper(engine(name))
    expect(code).toMatch(new RegExp(`import "[^"]+/styles/${file.replace('.', '\\.')}"`))
    expect(code).not.toContain(MATH_STYLES_ID)
  })

  it('resolves Temml cross-references, and only under Temml', async () => {
    expect(await wrapper(engine('temml'))).toContain('useTemmlRefs()')
    expect(await wrapper(engine('webc'))).not.toContain('useTemmlRefs')
  })

  it('styles the error placeholders when the engine failed to resolve', async () => {
    const code = await wrapper({ engine: 'nope' } as unknown as ApplyMathOptions)
    expect(code).toMatch(/import "[^"]+\/styles\/core\.css"/)
    expect(code).not.toContain(MATH_STYLES_ID)
    expect(code).toContain('useCopyTex()')
  })

  it('keeps the composables but imports nothing under `styles: false`', async () => {
    const code = await wrapper({ ...engine('katex'), styles: false })
    expect(code).not.toContain('.css')
    expect(code).toContain('useCopyTex()')
  })
})

describe('withMath', () => {
  interface ConfigStub {
    markdown?: { config?: (md: unknown) => unknown }
    vite?: { plugins?: unknown[] }
  }

  it('chains the markdown-it plugin onto the config object itself', async () => {
    const config: ConfigStub = {}
    withMath(config, engine('probe'))
    const md = new MarkdownIt()
    await config.markdown?.config?.(md)
    expect(md.render('$x$')).toContain('[I:x]')
  })

  it('registers the same plugins as the factory', () => {
    const config: ConfigStub = {}
    withMath(config, engine('probe'))
    expect(names(config.vite?.plugins?.[0] as { name: string }[])).toEqual([
      'vitepress-plugin-math:inject',
      'vitepress-plugin-math:katex-cdn',
      'vitepress-plugin-math:styles',
    ])
  })

  it('leaves the markdown wiring to the config object, never to the site config', () => {
    const config: ConfigStub = {}
    withMath(config, engine('probe'))
    const plugin = (config.vite?.plugins?.[0] as InjectPlugin[])[0] as InjectPlugin
    const site: SiteStub = {}
    plugin.configResolved({ vitepress: site })
    expect(site.markdown).toBeUndefined()
  })

  it('still wraps the theme, so styles and composables need no wiring either', async () => {
    const config: ConfigStub = {}
    withMath(config, engine('katex'))
    const plugin = (config.vite?.plugins?.[0] as InjectPlugin[])[0] as InjectPlugin
    const dir = fakeThemeDir('index.ts')
    plugin.configResolved({ vitepress: { themeDir: dir } })
    expect(await plugin.load(`${dir}/index.ts`)).toContain('useCopyTex()')
  })
})
