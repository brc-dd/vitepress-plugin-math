import MarkdownIt from 'markdown-it'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createKatexRenderer } from '../src/engines/katex.ts'
import { createMathJaxRenderer } from '../src/engines/mathjax.ts'
import { EngineMissingError, loadEngine } from '../src/engines/shared.ts'
import { createTemmlRenderer } from '../src/engines/temml.ts'
import { createWebcMathRenderer } from '../src/engines/webc.ts'
import { applyMath, ENGINE_PRIORITY, resolveRenderer } from '../src/index.ts'
import type { MathMarkdownIt, MathRenderContext, MathRenderer } from '../src/types.ts'
import { createMd } from './helpers.ts'

const inline: MathRenderContext = { display: false, inline: false, env: undefined }
const display: MathRenderContext = { display: true, inline: false, env: undefined }

/** The Node error shape for an unresolvable bare specifier. */
function moduleNotFound(specifier: string, code = 'ERR_MODULE_NOT_FOUND'): Error {
  const error = new Error(`Cannot find package '${specifier}' imported from /app/index.js`)
  Object.assign(error, { code })
  return error
}

describe('loadEngine', () => {
  it('returns what the loader resolves', async () => {
    await expect(loadEngine('katex', 'katex', async () => ({ ok: true }))).resolves.toEqual({
      ok: true,
    })
  })

  it('maps a missing engine package to EngineMissingError', async () => {
    const load = (): Promise<never> => Promise.reject(moduleNotFound('katex'))
    await expect(loadEngine('katex', 'katex', load)).rejects.toBeInstanceOf(EngineMissingError)
  })

  it('matches a double-quoted specifier too', async () => {
    const error = new Error('Cannot find module "temml"')
    Object.assign(error, { code: 'MODULE_NOT_FOUND' })
    await expect(loadEngine('temml', 'temml', () => Promise.reject(error))).rejects.toBeInstanceOf(
      EngineMissingError,
    )
  })

  it('rethrows when a different package is missing', async () => {
    // A broken transitive dependency must never read as "engine not installed".
    const error = moduleNotFound('some-transitive-dep')
    await expect(loadEngine('katex', 'katex', () => Promise.reject(error))).rejects.toBe(error)
  })

  it('rethrows a crash inside the engine', async () => {
    const error = new Error('boom')
    await expect(loadEngine('katex', 'katex', () => Promise.reject(error))).rejects.toBe(error)
  })

  it('rethrows a non-Error throw', async () => {
    await expect(
      loadEngine('webc', '@webc.site/math', () => Promise.reject([4, '\\ce'])),
    ).rejects.toEqual([4, '\\ce'])
  })
})

describe('EngineMissingError', () => {
  it('names the package and how to install it', () => {
    const error = new EngineMissingError('webc', '@webc.site/math')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('EngineMissingError')
    expect(error.engine).toBe('webc')
    expect(error.specifier).toBe('@webc.site/math')
    expect(error.message).toBe(
      '[vitepress-plugin-math] The "webc" engine needs the `@webc.site/math` package. ' +
        'Install it (e.g. `pnpm add -D @webc.site/math`) or configure a different engine.',
    )
  })
})

describe('resolveRenderer', () => {
  afterEach(() => {
    vi.doUnmock('../src/engines/mathjax.ts')
    vi.doUnmock('../src/engines/katex.ts')
    vi.doUnmock('../src/engines/temml.ts')
    vi.doUnmock('../src/engines/webc.ts')
    vi.resetModules()
  })

  it('auto-detects in mathjax → katex → temml → webc order', () => {
    expect(ENGINE_PRIORITY).toEqual(['mathjax', 'katex', 'temml', 'webc'])
  })

  it.each(['katex', 'temml', 'webc'] as const)('loads the "%s" engine by name', async (name) => {
    await expect(resolveRenderer({ engine: name })).resolves.toMatchObject({ name })
  })

  it('names the valid engines when given an unknown one', async () => {
    await expect(resolveRenderer({ engine: 'katx' as never })).rejects.toThrow(
      /Unknown engine 'katx'/,
    )
  })

  it('uses a custom renderer as-is', async () => {
    const renderer: MathRenderer = { name: 'custom', render: () => '' }
    await expect(resolveRenderer({ engine: renderer })).resolves.toBe(renderer)
  })

  it('skips engines whose package is missing', async () => {
    // The factory imports the *fresh* module registry so the thrown error is an
    // instance of the same class the fresh `index.ts` checks against.
    vi.resetModules()
    vi.doMock('../src/engines/mathjax.ts', async () => {
      const { EngineMissingError: Missing } = await import('../src/engines/shared.ts')
      return {
        createMathJaxRenderer: () => Promise.reject(new Missing('mathjax', 'mathjax')),
      }
    })
    const { resolveRenderer: resolve } = await import('../src/index.ts')
    await expect(resolve()).resolves.toMatchObject({ name: 'katex' })
  })

  it('rethrows a real engine failure instead of falling through', async () => {
    vi.resetModules()
    vi.doMock('../src/engines/mathjax.ts', () => ({
      createMathJaxRenderer: () => Promise.reject(new Error('mathjax exploded')),
    }))
    const { resolveRenderer: resolve } = await import('../src/index.ts')
    await expect(resolve()).rejects.toThrow('mathjax exploded')
  })

  it('is what `applyMath` installs, in one call', async () => {
    const md = new MarkdownIt()
    const renderer = await applyMath(md as unknown as MathMarkdownIt, {
      engine: 'temml',
      vPre: false,
      copySource: false,
    })
    expect(renderer.name).toBe('temml')
    expect(md.render('$x$')).toContain('<math')
  })

  it('lets `applyMath` take a custom renderer', async () => {
    const custom: MathRenderer = { name: 'custom', render: (tex) => `[${tex}]` }
    const md = new MarkdownIt()
    await expect(applyMath(md as unknown as MathMarkdownIt, { engine: custom })).resolves.toBe(
      custom,
    )
    expect(md.render('$x$')).toContain('[x]')
  })

  it('explains how to fix it when no engine is installed', async () => {
    vi.resetModules()
    for (const [file, factory] of [
      ['../src/engines/mathjax.ts', 'createMathJaxRenderer'],
      ['../src/engines/katex.ts', 'createKatexRenderer'],
      ['../src/engines/temml.ts', 'createTemmlRenderer'],
      ['../src/engines/webc.ts', 'createWebcMathRenderer'],
    ] as const) {
      vi.doMock(file, async () => {
        const { EngineMissingError: Missing } = await import('../src/engines/shared.ts')
        return { [factory]: () => Promise.reject(new Missing(factory, factory)) }
      })
    }
    const { resolveRenderer: resolve } = await import('../src/index.ts')
    await expect(resolve()).rejects.toThrow(/No math engine found/)
  })
})

describe('katex', () => {
  let renderer: MathRenderer

  beforeAll(async () => {
    renderer = await createKatexRenderer()
  })

  it('renders HTML and MathML with the TeX annotation', () => {
    const html = renderer.render('x^2', inline)
    expect(html).toContain('class="katex"')
    expect(html).toContain('<annotation encoding="application/x-tex">x^2</annotation>')
  })

  it('marks display mode', () => {
    expect(renderer.render('x^2', display)).toContain('display="block"')
    expect(renderer.render('x^2', inline)).not.toContain('display="block"')
  })

  it('is stateless (no reset hook)', () => {
    expect(renderer.reset).toBeUndefined()
    expect(renderer.name).toBe('katex')
  })

  it('does not throw on bad TeX by default', () => {
    const html = renderer.render('\\unknowncmd', inline)
    expect(html).toContain('#cc0000')
    expect(html).toContain('\\unknowncmd')
  })

  it('loads mhchem', () => {
    expect(renderer.render('\\ce{H2O}', inline)).not.toContain('#cc0000')
  })

  it('can skip the mhchem import', async () => {
    const noMhchem = await createKatexRenderer({ mhchem: false })
    expect(noMhchem.render('x^2', inline)).toContain('class="katex"')
  })

  it('forwards katex options', async () => {
    const mathmlOnly = await createKatexRenderer({ katex: { output: 'mathml' } })
    expect(mathmlOnly.render('x^2', inline)).not.toContain('katex-html')
  })

  it('surfaces errors through the plugin wrapper with throwOnError', async () => {
    const strict = await createKatexRenderer({ katex: { throwOnError: true } })
    const md = createMd({ renderer: strict, vPre: false, copySource: false })
    expect(md.render('$\\unknowncmd$')).toContain('vpm-error')
  })
})

describe('temml', () => {
  let renderer: MathRenderer

  beforeAll(async () => {
    renderer = await createTemmlRenderer()
  })

  it('renders MathML only', () => {
    const html = renderer.render('x^2', inline)
    expect(html.startsWith('<math')).toBe(true)
    expect(html).not.toContain('<span')
  })

  it('marks display mode', () => {
    expect(renderer.render('x^2', display)).toContain('display="block"')
    expect(renderer.render('x^2', display)).toContain('tml-display')
  })

  it('does not throw on bad TeX by default', () => {
    expect(renderer.render('\\unknowncmd', inline)).toContain('#b22222')
  })

  it('isolates `\\gdef` between renders through reset()', () => {
    expect(renderer.render('\\gdef\\foo{1}\\foo', inline)).toContain('<mn>1</mn>')
    expect(renderer.render('\\foo', inline)).toContain('<mn>1</mn>')
    renderer.reset?.()
    expect(renderer.render('\\foo', inline)).toContain('#b22222')
  })

  it('isolates pages when driven by markdown-it', async () => {
    const md = createMd({ renderer: await createTemmlRenderer(), vPre: false, copySource: false })
    expect(md.render('$\\gdef\\foo{2}\\foo$')).toContain('<mn>2</mn>')
    expect(md.render('$\\foo$')).toContain('#b22222')
  })

  it('keeps configured macros across resets', async () => {
    const withMacros = await createTemmlRenderer({ temml: { macros: { '\\R': '\\mathbb{R}' } } })
    expect(withMacros.render('\\R', inline)).not.toContain('#b22222')
    withMacros.reset?.()
    expect(withMacros.render('\\R', inline)).not.toContain('#b22222')
  })
})

describe('webc', () => {
  let renderer: MathRenderer

  beforeAll(async () => {
    renderer = await createWebcMathRenderer()
  })

  it('renders MathML with the TeX annotation', () => {
    const html = renderer.render('x^2', inline)
    expect(html.startsWith('<math')).toBe(true)
    expect(html).toContain('<annotation encoding="application/x-tex">x^2</annotation>')
  })

  it('marks display mode', () => {
    expect(renderer.render('x^2', display)).toContain('display="block"')
  })

  it('throws raw arrays for unsupported commands', () => {
    expect(() => renderer.render('\\ce{H2O}', inline)).toThrow()
    try {
      renderer.render('\\ce{H2O}', inline)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(Array.isArray(error)).toBe(true)
    }
  })

  it('turns a raw-array throw into an error placeholder', () => {
    const md = createMd({ renderer, vPre: false, copySource: false })
    const html = md.render('$\\ce{H2O}$')
    expect(html).toContain('class="vpm vpm-inline vpm-error"')
    expect(html).toContain(String.raw`title="[4,&quot;\\ce&quot;]"`)
    expect(html).toContain('$\\ce{H2O}$')
  })
})

describe('mathjax', () => {
  let renderer: MathRenderer

  beforeAll(async () => {
    renderer = await createMathJaxRenderer()
  }, 60_000)

  afterAll(async () => {
    // MathJax may hold worker threads open; `finalize()` must settle cleanly.
    await renderer?.finalize?.()
  }, 60_000)

  it('renders SVG output', () => {
    const html = renderer.render('x^2', inline)
    expect(html).toContain('<mjx-container class="MathJax" jax="SVG"')
    expect(html).toContain('<svg')
    expect(renderer.render('x^2', display)).toContain('display="true"')
  })

  it('embeds assistive MathML', () => {
    const html = renderer.render('x^2', inline)
    expect(html).toContain('<mjx-assistive-mml')
    expect(html).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML"')
  })

  it('renders characters outside the base font ranges synchronously', () => {
    // Without `loadDynamicFiles()` at init these throw "retry".
    expect(() => renderer.render('\\mathfrak{A}\\mathbb{R}\\text{Привет}', inline)).not.toThrow()
  })

  it('exposes a non-empty stylesheet', () => {
    const css = renderer.stylesheet?.() ?? ''
    expect(css.length).toBeGreaterThan(1000)
    expect(css).toContain('mjx-container')
  })

  it('resets AMS equation numbering', () => {
    const tag = (): string | undefined =>
      /mjx-eqn:(\d+)/.exec(renderer.render('\\begin{equation}x\\end{equation}', display))?.[1]
    renderer.reset?.()
    expect(tag()).toBe('1')
    expect(tag()).toBe('2')
    renderer.reset?.()
    expect(tag()).toBe('1')
  })

  it('numbers equations per page when driven by markdown-it', async () => {
    const md = createMd({ renderer, vPre: false, copySource: false })
    const page = '$$\n\\begin{equation}x\\end{equation}\n$$'
    const first = md.render(page)
    const second = md.render(page)
    expect(/mjx-eqn:(\d+)/.exec(first)?.[1]).toBe('1')
    expect(/mjx-eqn:(\d+)/.exec(second)?.[1]).toBe('1')
  })
})
