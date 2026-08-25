import type MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import {
  createFixtureMd,
  createLabelProbeRenderer,
  readFixtures,
  type TestMdOptions,
} from './helpers.ts'

/** Fixture file → the plugin options its expected output was written for. */
const SUITES: [file: string, options: TestMdOptions][] = [
  ['inline-dollars', {}],
  ['block-dollars', {}],
  ['brackets', {}],
  ['fence', {}],
  ['labels', { labels: true, renderer: createLabelProbeRenderer() }],
  ['allow-space', { allowInlineWithSpace: true }],
]

describe.each(SUITES)('fixtures: %s', (file, options) => {
  const md = createFixtureMd(options)
  for (const fixture of readFixtures(file)) {
    it(`${fixture.name} (${file}.md:${fixture.line})`, () => {
      expect(md.render(fixture.input).trim()).toBe(fixture.expected.trim())
    })
  }
})

const md = createFixtureMd()

/** Content of the first `math_block` token, or `undefined` when there is none. */
function blockContent(src: string, instance: MarkdownIt = md): string | undefined {
  return instance.parse(src, {}).find((token) => token.type === 'math_block')?.content
}

/** Every math token produced for `src`, block and inline. */
function mathTokens(src: string, instance: MarkdownIt = md): { type: string; content: string }[] {
  const found: { type: string; content: string }[] = []
  for (const token of instance.parse(src, {})) {
    for (const candidate of token.type === 'inline' ? (token.children ?? []) : [token]) {
      if (candidate.type.startsWith('math_')) {
        found.push({ type: candidate.type, content: candidate.content })
      }
    }
  }
  return found
}

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1

describe('inline silent mode (link-label probing)', () => {
  it('leaves the label text alone when the math never closes', () => {
    expect(md.renderInline('[link $ a=1$](url)')).toBe('<a href="url">link $ a=1$</a>')
    expect(md.renderInline('[link $a=1](url)')).toBe('<a href="url">link $a=1</a>')
    expect(md.renderInline('[link $$](url)')).toBe('<a href="url">link $$</a>')
    expect(md.renderInline('[link $a=1 $](url)')).toBe('<a href="url">link $a=1 $</a>')
  })

  it('parses bracket math inside a label exactly once', () => {
    expect(md.renderInline(String.raw`[link \(a=1\)](url)`)).toBe(
      '<a href="url">link <span class="vpm vpm-inline">[I:a=1]</span></a>',
    )
    expect(md.renderInline(String.raw`[link \\(a=1\)](url)`)).toBe(
      String.raw`<a href="url">link \(a=1)</a>`,
    )
    expect(md.renderInline(String.raw`[link \(a=1 \\) \)](url)`)).toBe(
      '<a href="url">link <span class="vpm vpm-inline">[I:a=1 \\\\) ]</span></a>',
    )
  })

  it('never double-renders math that a label probe already walked past', () => {
    // `skipToken` restores only `state.pos`; a rule that touched `pending`
    // or pushed a token under `silent` would leak the math twice.
    const html = md.render('[a $b$ c](url) and [d $$e$$ f](url)')
    expect(count(html, '[I:b]')).toBe(1)
    expect(count(html, '[ID:e]')).toBe(1)
    expect(count(html, '<a href="url">')).toBe(2)
  })

  it('keeps math out of an unterminated label', () => {
    expect(md.render('[link $incomplete](url').trim()).toBe('<p>[link $incomplete](url</p>')
    expect(md.render('![alt $incomplete').trim()).toBe('<p>![alt $incomplete</p>')
  })
})

describe('posMax clamping', () => {
  it('does not scan past the end of a link label', () => {
    expect(md.render('[x $a](u) $b$').trim()).toBe(
      '<p><a href="u">x $a</a> <span class="vpm vpm-inline">[I:b]</span></p>',
    )
  })

  it('does not scan past the end of an image label', () => {
    expect(md.render('![x $a](u) $b$').trim()).toBe(
      '<p><img src="u" alt="x $a"> <span class="vpm vpm-inline">[I:b]</span></p>',
    )
  })

  it('keeps a balanced display expression inside the label', () => {
    expect(md.render('[a $$b$$](u) $$c$$').trim()).toBe(
      '<p><a href="u">a <span class="vpm vpm-display vpm-display-inline" data-display="true">' +
        '[ID:b]</span></a> <span class="vpm vpm-display vpm-display-inline" data-display="true">' +
        '[ID:c]</span></p>',
    )
  })

  it('leaves an unbalanced marker in the label as text', () => {
    expect(md.render('[a $$b](u) text').trim()).toBe('<p><a href="u">a $$b</a> text</p>')
  })
})

describe('backslash parity', () => {
  it.each([
    [String.raw`$test\\$`, [{ type: 'math_inline', content: String.raw`test\\` }]],
    [String.raw`$test\\\$`, []],
    [String.raw`$test\\\\$`, [{ type: 'math_inline', content: String.raw`test\\\\` }]],
    [String.raw`\$x$`, []],
    [String.raw`\\$x$`, [{ type: 'math_inline', content: 'x' }]],
    [String.raw`\(x\)`, [{ type: 'math_inline', content: 'x' }]],
    [String.raw`\\(x\)`, []],
    [String.raw`\\\(x\)`, [{ type: 'math_inline', content: 'x' }]],
    [String.raw`\\\\(x\)`, []],
    [String.raw`\(x\\\)`, [{ type: 'math_inline', content: String.raw`x\\` }]],
    [String.raw`\[x\\\]`, [{ type: 'math_block', content: String.raw`x\\` }]],
    [String.raw`\\[x\]`, []],
  ])('%s', (src, expected) => {
    expect(mathTokens(src)).toEqual(expected)
  })

  it('an escaped closing marker cannot close a block', () => {
    expect(mathTokens('$$\na=1\n\\$$')).toEqual([])
  })
})

describe('tables', () => {
  it('math survives an escaped pipe in a cell', () => {
    // `escapedSplit()` drops the backslash of `\|` before inline parsing, so
    // the cell already reads `$x|y$` — the plugin must not unescape anything.
    const html = md.render('| a |\n| - |\n| $x\\|y$ |')
    expect(html).toContain('[I:x|y]')
  })

  it('an unescaped pipe inside math splits the cell', () => {
    const html = md.render('| a | b |\n| - | - |\n| $x|y$ | z |')
    expect(html).not.toContain('[I:')
    expect(html).toContain('<td>$x</td>')
  })

  it('display math is inline-legal inside a cell', () => {
    const html = md.render('| a |\n| - |\n| $$x$$ |')
    expect(html).toContain('<td><span class="vpm vpm-display vpm-display-inline"')
    expect(html).not.toContain('<div')
  })

  it('a block interrupts the table (the blockquote terminator chain)', () => {
    const html = md.render('| a |\n| - |\n| x |\n$$\ny=1\n$$')
    expect(html).toContain('</table>')
    expect(blockContent('| a |\n| - |\n| x |\n$$\ny=1\n$$')).toBe('y=1')
  })
})

describe('blockquotes and lazy continuation', () => {
  it('parses a fully quoted block', () => {
    expect(blockContent('> $$\n> x\n> $$')).toBe('x')
  })

  it('emits no spurious empty block for a lazy closing marker', () => {
    const tokens = mathTokens('> $$\n> a=1\n$$')
    expect(tokens.every((token) => token.content !== '')).toBe(true)
    expect(tokens).toEqual([{ type: 'math_inline_display', content: '\na=1\n' }])
  })

  it('does not swallow what follows a lazily closed block', () => {
    const html = md.render('> $$\n> a=1\n$$\n\nafter')
    expect(html).toContain('</blockquote>')
    expect(html).toContain('<p>after</p>')
  })

  it('keeps blockquote content out of a block that starts outside it', () => {
    const html = md.render('$$\nx\n$$\n\n> quoted')
    expect(blockContent('$$\nx\n$$\n\n> quoted')).toBe('x')
    expect(html).toContain('<blockquote>')
  })
})

describe('four-space indent guards', () => {
  it('an indented opening marker is a code block', () => {
    const src = '    $$\n    1+1 = 2\n    $$'
    expect(mathTokens(src)).toEqual([])
    expect(md.render(src)).toContain('<pre><code>$$')
  })

  it('an indented closing marker cannot close the block', () => {
    expect(mathTokens('$$\n1+1 = 2\n    $$')).toEqual([
      { type: 'math_inline_display', content: '\n1+1 = 2\n    ' },
    ])
  })

  it('leaves no stray empty block after indented code', () => {
    const tokens = mathTokens('    code\n\n$$\nx\n$$')
    expect(tokens).toEqual([{ type: 'math_block', content: 'x' }])
  })

  it('an indented fence inside a list still renders math', () => {
    expect(blockContent('- ```math\n  a=1\n  ```')).toBeUndefined()
    expect(md.render('- ```math\n  a=1\n  ```')).toContain('[D:a=1]')
  })
})

describe('paragraph-interrupt (`alt`) chain', () => {
  it.each([
    ['paragraph', 'text\n$$\nx\n$$'],
    ['reference', '[a]: /url\n$$\nx\n$$'],
    ['blockquote', '> quoted\n> $$\n> x\n> $$'],
    ['list', '- item\n\n  $$\n  x\n  $$'],
  ])('interrupts a %s', (_name, src) => {
    expect(blockContent(src)).toBe('x')
  })

  it('produces exactly one token when the silent probe ran first', () => {
    expect(mathTokens('text\n$$\nx\n$$')).toEqual([{ type: 'math_block', content: 'x' }])
  })

  it('bracket blocks interrupt a paragraph too', () => {
    expect(blockContent('paragraph\n\\[\na=1\n\\]')).toBe('a=1')
  })
})

describe('line endings', () => {
  it.each([
    ['block', '$$\r\na=1\r\n$$\r\n', '[D:a=1]'],
    ['inline', 'a $x$ b\r\n', '[I:x]'],
    ['fence', '```math\r\na=1\r\n```\r\n', '[D:a=1]'],
    ['display inline', 'a $$x$$ b\r\n', '[ID:x]'],
  ])('handles CRLF input (%s)', (_name, src, expected) => {
    expect(md.render(src)).toContain(expected)
  })

  it('does not keep a carriage return in the content', () => {
    expect(blockContent('$$\r\na=1\r\nb=2\r\n$$\r\n')).toBe('a=1\nb=2')
  })
})

describe('empty expressions', () => {
  it('`$$$$` on its own line is an empty display block', () => {
    expect(mathTokens('$$$$')).toEqual([{ type: 'math_block', content: '' }])
  })

  it('`$$$$` mid-paragraph is literal', () => {
    expect(md.render('a $$$$ b').trim()).toBe('<p>a $$$$ b</p>')
  })

  it('`$$` alone is literal', () => {
    expect(md.render('$$').trim()).toBe('<p>$$</p>')
  })

  it('`\\(\\)` is an empty inline expression', () => {
    expect(mathTokens(String.raw`\(\)`)).toEqual([{ type: 'math_inline', content: '' }])
  })

  it('`\\[\\]` is an empty display block', () => {
    expect(mathTokens(String.raw`\[\]`)).toEqual([{ type: 'math_block', content: '' }])
  })
})

describe('multiline inline math', () => {
  it('keeps the newline in the content', () => {
    expect(mathTokens('$x +\ny$')).toEqual([{ type: 'math_inline', content: 'x +\ny' }])
  })

  it('stops at a blank line', () => {
    expect(mathTokens('$x +\n\ny$')).toEqual([])
  })

  it('works for bracket delimiters', () => {
    expect(mathTokens('\\(x +\ny\\)')).toEqual([{ type: 'math_inline', content: 'x +\ny' }])
  })
})

describe('token shape', () => {
  it('describes a block token', () => {
    const labelMd = createFixtureMd({ labels: true, renderer: createLabelProbeRenderer() })
    const [token, ...rest] = labelMd.parse('$$\na\n$$ (label)', {})
    expect(rest).toEqual([])
    expect(token).toMatchObject({
      type: 'math_block',
      tag: 'math',
      content: 'a',
      markup: '$$',
      block: true,
      map: [0, 3],
      meta: { label: 'label' },
    })
  })

  it('describes inline tokens', () => {
    const children = md.parseInline('a $x$ b $$y$$ c \\(z\\) d \\[w\\]', {})[0]?.children ?? []
    expect(
      children
        .filter((token) => token.type.startsWith('math_'))
        .map(({ type, tag, markup, content }) => ({ type, tag, markup, content })),
    ).toEqual([
      { type: 'math_inline', tag: 'math', markup: '$', content: 'x' },
      { type: 'math_inline_display', tag: 'math', markup: '$$', content: 'y' },
      { type: 'math_inline', tag: 'math', markup: '\\(', content: 'z' },
      { type: 'math_inline_display', tag: 'math', markup: '\\[', content: 'w' },
    ])
  })

  it('maps a block to its source lines', () => {
    const token = md.parse('text\n\n$$\nx\n$$\n', {}).find((t) => t.type === 'math_block')
    expect(token?.map).toEqual([2, 5])
  })
})

describe('image alt text', () => {
  it.each([
    ['![$a$ alt](x.png)', 'alt="$a$ alt"'],
    ['![$$a$$ alt](x.png)', 'alt="$$a$$ alt"'],
    ['![before ![$b$ nested](n.png) after](x.png)', 'alt="before $b$ nested after"'],
    ['![plain](x.png)', 'alt="plain"'],
  ])('renders %s as text', (src, expected) => {
    expect(md.render(src)).toContain(expected)
  })

  it("leaves markdown-it's own alt-text handling alone", () => {
    // Upstream `renderInlineAsText` keeps text/image/html/breaks and drops
    // everything else (code spans included) — the plugin only adds math.
    expect(md.render('![a `code` *em*](x.png)')).toContain('alt="a  em"')
  })
})

describe('fixed deviations (dedent, multi-pair lines, link labels)', () => {
  it('dedents block content relative to the opening marker', () => {
    expect(blockContent('   $$\n   1+1 = 2\n   $$')).toBe('1+1 = 2')
  })

  it('keeps the closing line indentation out of the content', () => {
    expect(blockContent('$$\na=1\n   $$')).toBe('a=1')
  })

  it('treats two `$$` pairs on one line as inline display math', () => {
    expect(md.render('$$A$$ $$B$$').trim()).toBe(
      '<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:A]</span> ' +
        '<span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:B]</span></p>',
    )
  })

  it('does not let an inline `$` closer cross a link label', () => {
    expect(md.render('[x $a](u)$b$').trim()).toBe(
      '<p><a href="u">x $a</a><span class="vpm vpm-inline">[I:b]</span></p>',
    )
  })

  it('does not let an inline `$$` closer cross a link label', () => {
    expect(md.render('[a $$b](u) $$c$$').trim()).toBe(
      '<p><a href="u">a $$b</a> ' +
        '<span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:c]</span></p>',
    )
  })
})
