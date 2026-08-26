import MarkdownIt from 'markdown-it'
import { describe, expect, it, vi } from 'vitest'
import { EngineSetupError } from '../src/engines/shared.ts'
import { mathPlugin } from '../src/plugin.ts'
import type { MathMarkdownIt, MathRenderContext, MathRenderer } from '../src/types.ts'
import { createMd, createProbeRenderer, probeMarker } from './helpers.ts'

const strip = (html: string): string => html.trim()

/** A renderer that always throws `thrown`. */
function throwingRenderer(thrown: unknown): MathRenderer {
  return {
    name: 'throwing',
    render: () => {
      throw thrown
    },
  }
}

describe('wrapper markup', () => {
  const md = createMd()

  it('wraps inline math in a v-pre span carrying the source', () => {
    expect(strip(md.render('$x$'))).toBe(
      '<p><span class="vpm vpm-inline" v-pre data-tex="x">[I:x]</span></p>',
    )
  })

  it('wraps a display block in a focusable div', () => {
    expect(strip(md.render('$$\nx\n$$'))).toBe(
      '<div class="vpm vpm-display" v-pre data-display="true" tabindex="0" data-tex="x">' +
        '[D:x]</div>',
    )
  })

  it('wraps mid-paragraph display math in an inline-legal span', () => {
    // No `tabindex` and never a `<div>`: this sits inside a `<p>`.
    expect(strip(md.render('a $$x$$ b'))).toBe(
      '<p>a <span class="vpm vpm-display vpm-display-inline" v-pre data-display="true" ' +
        'data-tex="x">[ID:x]</span> b</p>',
    )
  })

  it('gives the fence the same wrapper as a `$$` block', () => {
    expect(strip(md.render('```math\nx\n```'))).toBe(strip(md.render('$$\nx\n$$')))
  })

  it('escapes `data-tex`', () => {
    expect(md.render('$a<b>&"c"$')).toContain('data-tex="a&lt;b&gt;&amp;&quot;c&quot;"')
  })

  it('keeps newlines inside `data-tex`', () => {
    expect(md.render('a $$x\ny$$ b')).toContain('data-tex="x\ny"')
  })

  it('round-trips the source, not the transformed TeX', () => {
    const transformed = createMd({ transformTex: (tex) => `${tex}+transformed` })
    const html = transformed.render('$x$')
    expect(html).toContain('data-tex="x"')
    expect(html).toContain('[I:x+transformed]')
  })

  it('drops `v-pre` when `vPre` is off', () => {
    expect(strip(createMd({ vPre: false }).render('$x$'))).toBe(
      '<p><span class="vpm vpm-inline" data-tex="x">[I:x]</span></p>',
    )
  })

  it('drops `data-tex` when `copySource` is off', () => {
    expect(strip(createMd({ copySource: false }).render('$$\nx\n$$'))).toBe(
      '<div class="vpm vpm-display" v-pre data-display="true" tabindex="0">[D:x]</div>',
    )
  })

  it('inserts renderer output verbatim', () => {
    const raw = createMd({ renderer: { name: 'raw', render: () => '<b>&amp;</b>' } })
    expect(raw.render('$x$')).toContain('<b>&amp;</b>')
  })
})

describe('render context', () => {
  it('reports display, inline and env for every position', () => {
    const seen: { tex: string; display: boolean; inline: boolean; env: unknown }[] = []
    const md = createMd({
      renderer: {
        name: 'ctx',
        render: (tex, ctx) => {
          seen.push({ tex, display: ctx.display, inline: ctx.inline, env: ctx.env })
          return probeMarker(ctx)
        },
      },
    })
    const env = { page: 'index.md' }
    md.render('$a$\n\n$$\nb\n$$\n\nc $$d$$ e\n\n```math\nf\n```', env)
    expect(seen).toEqual([
      { tex: 'a', display: false, inline: false, env },
      { tex: 'b', display: true, inline: false, env },
      { tex: 'd', display: true, inline: true, env },
      { tex: 'f', display: true, inline: false, env },
    ])
  })

  it('passes the label only when `labels` is on', () => {
    const labels: (string | undefined)[] = []
    const renderer: MathRenderer = {
      name: 'label',
      render: (_tex, ctx) => {
        labels.push(ctx.label)
        return ''
      },
    }
    createMd({ renderer, labels: true }).render('$$x$$ (eq-1)')
    createMd({ renderer }).render('$$x$$ (eq-1)')
    expect(labels).toEqual(['eq-1', undefined])
  })

  it('hands `transformTex` the same context', () => {
    const contexts: MathRenderContext[] = []
    const md = createMd({
      labels: true,
      transformTex: (tex, ctx) => {
        contexts.push(ctx)
        return tex
      },
    })
    md.render('$$x$$ (eq-1)')
    expect(contexts).toEqual([{ display: true, inline: false, env: {}, label: 'eq-1' }])
  })
})

describe('error handling', () => {
  it('emits an error placeholder instead of throwing', () => {
    const md = createMd({ renderer: throwingRenderer(new Error('boom <&">')) })
    expect(strip(md.render('$a<b$'))).toBe(
      '<p><span class="vpm vpm-inline vpm-error" v-pre data-tex="a&lt;b" ' +
        'title="boom &lt;&amp;&quot;&gt;">$a&lt;b$</span></p>',
    )
  })

  it('keeps display delimiters and the block wrapper on error', () => {
    const md = createMd({ renderer: throwingRenderer(new Error('nope')) })
    expect(strip(md.render('$$\nx\n$$'))).toBe(
      '<div class="vpm vpm-display vpm-error" v-pre data-display="true" tabindex="0" ' +
        'data-tex="x" title="nope">$$x$$</div>',
    )
    expect(strip(md.render('a $$x$$ b'))).toContain(
      '<span class="vpm vpm-display vpm-display-inline vpm-error"',
    )
  })

  it('JSON-encodes a non-Error throw (@webc.site/math throws raw arrays)', () => {
    const md = createMd({ renderer: throwingRenderer([4, '\\ce']) })
    expect(md.render('$x$')).toContain(String.raw`title="[4,&quot;\\ce&quot;]"`)
  })

  it('falls back to String() when the throw is not JSON-serialisable', () => {
    const circular: Record<string, unknown> = {}
    circular['self'] = circular
    const md = createMd({ renderer: throwingRenderer(circular) })
    expect(md.render('$x$')).toContain('title="[object Object]"')
  })

  it('rethrows with `throwOnError`', () => {
    const md = createMd({ renderer: throwingRenderer(new Error('boom')), throwOnError: true })
    expect(() => md.render('$x$')).toThrow('boom')
    expect(() => md.render('$$\nx\n$$')).toThrow('boom')
  })

  it('rethrows the original value, not a wrapper', () => {
    const thrown = [4, '\\ce']
    const md = createMd({ renderer: throwingRenderer(thrown), throwOnError: true })
    expect(() => md.render('$x$')).toThrow(thrown as unknown as Error)
  })

  it('never placeholders an engine setup failure', () => {
    // A site-level failure has to reach VitePress: a page of placeholders
    // would let a build with no working engine succeed.
    const md = createMd({ renderer: throwingRenderer(new EngineSetupError(new Error('boom'))) })
    expect(() => md.render('$x$')).toThrow(EngineSetupError)
    expect(() => md.render('$x$')).toThrow('boom')
    expect(() => md.render('$$\nx\n$$')).toThrow('boom')
    expect(() => md.render('```math\nx\n```')).toThrow('boom')
  })

  it('requires a renderer', () => {
    expect(() =>
      mathPlugin(new MarkdownIt() as unknown as MathMarkdownIt, {
        renderer: undefined as unknown as MathRenderer,
      }),
    ).toThrow(TypeError)
  })
})

describe('options', () => {
  it('`delimiters: "dollars"` ignores bracket syntax', () => {
    const md = createMd({ delimiters: 'dollars' })
    expect(strip(md.render(String.raw`\(a=1\)`))).toBe('<p>(a=1)</p>')
    expect(strip(md.render(String.raw`\[a=1\]`))).toBe('<p>[a=1]</p>')
    expect(md.render('$a=1$')).toContain('[I:a=1]')
    expect(md.render('$$\na=1\n$$')).toContain('[D:a=1]')
  })

  it('`delimiters: "brackets"` ignores dollar syntax', () => {
    const md = createMd({ delimiters: 'brackets' })
    expect(strip(md.render('$a = 1$'))).toBe('<p>$a = 1$</p>')
    expect(strip(md.render('$$a = 1$$'))).toBe('<p>$$a = 1$$</p>')
    expect(md.render(String.raw`\(a=1\)`)).toContain('[I:a=1]')
    expect(md.render(String.raw`\[a=1\]`)).toContain('[D:a=1]')
  })

  it('`delimiters: "all"` is the default', () => {
    const md = createMd()
    expect(md.render(String.raw`$a$ and \(b\)`)).toContain('[I:a]')
    expect(md.render(String.raw`$a$ and \(b\)`)).toContain('[I:b]')
  })

  it('`mathFence: false` leaves the fence to the default renderer', () => {
    const md = createMd({ mathFence: false })
    expect(strip(md.render('```math\na=1\n```'))).toBe(
      '<pre><code class="language-math">a=1\n</code></pre>',
    )
  })

  it('`allowInlineWithSpace: true` accepts padded delimiters', () => {
    const md = createMd({ allowInlineWithSpace: true })
    expect(md.render('$ a = 1 $')).toContain('[I: a = 1 ]')
    expect(createMd().render('$ a = 1 $')).not.toContain('[I:')
  })

  it('`inlineDisplay: false` makes mid-paragraph `$$` literal', () => {
    const md = createMd({ inlineDisplay: false })
    expect(strip(md.render('a $$x$$ b'))).toBe('<p>a $$x$$ b</p>')
    expect(strip(md.render('$$x$$ tail'))).toBe('<p>$$x$$ tail</p>')
    expect(md.render('$$\nx\n$$')).toContain('[D:x]')
  })

  it('`labels` is off by default', () => {
    expect(strip(createMd().render('$$x$$ (eq-1)'))).toContain('(eq-1)')
  })
})

describe('fence chaining', () => {
  function setup(): { md: MarkdownIt; calls: string[]; thisValues: unknown[] } {
    const md = new MarkdownIt()
    const calls: string[] = []
    const thisValues: unknown[] = []
    const original = md.renderer.rules['fence']!
    md.renderer.rules['fence'] = function (tokens, idx, options, env, self) {
      calls.push(tokens[idx]!.info)
      thisValues.push(this)
      return original.call(this, tokens, idx, options, env, self)
    }
    mathPlugin(md as unknown as MathMarkdownIt, {
      renderer: createProbeRenderer(),
      vPre: false,
      copySource: false,
    })
    return { md, calls, thisValues }
  }

  it('still calls a previously registered fence rule for other languages', () => {
    const { md, calls } = setup()
    expect(md.render('```js\nconst a = 1\n```')).toContain('<code class="language-js">')
    expect(calls).toEqual(['js'])
  })

  it('does not call it for math fences', () => {
    const { md, calls } = setup()
    expect(md.render('```math {1}\na=1\n```')).toContain('[D:a=1]')
    expect(calls).toEqual([])
  })

  it('calls it with the `this` markdown-it would have used', () => {
    // markdown-it invokes renderer rules as `rules[type](…)`, so `this` is the
    // rules table; the delegating wrapper must not swallow that.
    const { md, thisValues } = setup()
    md.render('```\nplain\n```')
    expect(thisValues).toHaveLength(1)
    expect(thisValues[0]).toBe(md.renderer.rules)
  })

  it('keeps working when no fence rule was registered', () => {
    const md = new MarkdownIt()
    delete md.renderer.rules['fence']
    mathPlugin(md as unknown as MathMarkdownIt, { renderer: createProbeRenderer() })
    expect(md.render('```math\na=1\n```')).toContain('[D:a=1]')
    expect(md.render('```js\nx\n```')).toBe('')
  })
})

describe('renderer lifecycle', () => {
  function setup(): { md: MarkdownIt; events: string[]; reset: ReturnType<typeof vi.fn> } {
    const events: string[] = []
    const reset = vi.fn(() => {
      events.push('reset')
    })
    const md = createMd({
      renderer: {
        name: 'lifecycle',
        render: (tex) => {
          events.push(`render:${tex}`)
          return ''
        },
        reset,
      },
    })
    return { md, events, reset }
  }

  it('resets once per render, before any expression', () => {
    const { md, events, reset } = setup()
    md.render('$a$\n\n$$\nb\n$$')
    expect(reset).toHaveBeenCalledTimes(1)
    expect(events).toEqual(['reset', 'render:a', 'render:b'])
  })

  it('resets even when the page has no math', () => {
    const { md, reset } = setup()
    md.render('nothing here')
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('resets once per render, not once per page render call', () => {
    const { md, reset } = setup()
    md.render('$a$')
    md.render('$b$')
    expect(reset).toHaveBeenCalledTimes(2)
  })

  it('does not reset for `renderInline`', () => {
    const { md, reset } = setup()
    md.renderInline('$a$')
    expect(reset).not.toHaveBeenCalled()
  })

  it('works with a renderer that has no reset', () => {
    const md = createMd({ renderer: { name: 'plain', render: (tex) => `[${tex}]` } })
    expect(md.render('$a$')).toContain('[a]')
  })
})
