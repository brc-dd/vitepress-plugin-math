import { createBracketBlockRule, createDollarBlockRule } from './parser/block.ts'
import { createBracketInlineRule, createDollarInlineRule } from './parser/inline.ts'
import { createWrapperRenderer } from './render.ts'
import type { MathMarkdownIt, MathPluginOptions, MathToken } from './types.ts'

/** markdown-it's `alt` list: the constructs a math block may interrupt. */
const BLOCK_ALT = ['paragraph', 'reference', 'blockquote', 'list']

function asTextToken(token: MathToken): MathToken {
  // `renderInlineAsText` (image alt text) only understands a few token
  // types — represent math as its delimited source instead of dropping it,
  // re-using the delimiters the author wrote (token.markup).
  if (token.type === 'math_inline') {
    if (token.markup.startsWith('$`')) {
      // GitHub's `` $`…`$ ``: the closer is the opener's backtick run, then `$`.
      const close = `${token.markup.slice(1)}$`
      return { ...token, type: 'text', content: `${token.markup}${token.content}${close}` }
    }
    const [open, close] = token.markup === '\\(' ? ['\\(', '\\)'] : ['$', '$']
    return { ...token, type: 'text', content: `${open}${token.content}${close}` }
  }
  if (token.type === 'math_inline_display') {
    const [open, close] = token.markup === '\\[' ? ['\\[', '\\]'] : ['$$', '$$']
    return { ...token, type: 'text', content: `${open}${token.content}${close}` }
  }
  return token
}

/**
 * The engine-agnostic markdown-it plugin: registers the TeX parsing rules and
 * delegates rendering to `options.renderer`. Synchronous — do any async
 * engine setup before calling this (see `applyMath` for the packaged flow).
 */
export function mathPlugin(md: MathMarkdownIt, options: MathPluginOptions): void {
  const renderer = options.renderer
  if (typeof renderer?.render !== 'function') {
    throw new TypeError('[vitepress-plugin-math] `renderer` must implement render(tex, ctx)')
  }

  const resolved = {
    delimiters: options.delimiters ?? 'all',
    mathFence: options.mathFence ?? true,
    allowInlineWithSpace: options.allowInlineWithSpace ?? false,
    inlineDisplay: options.inlineDisplay ?? true,
    labels: options.labels ?? false,
    vPre: options.vPre ?? true,
    copySource: options.copySource ?? true,
    throwOnError: options.throwOnError ?? false,
    renderer,
    ...(options.transformTex ? { transformTex: options.transformTex } : {}),
  }

  const wrapper = createWrapperRenderer(md, resolved)
  const dollars = resolved.delimiters !== 'brackets'
  const brackets = resolved.delimiters !== 'dollars'

  if (dollars) {
    md.inline.ruler.after('escape', 'math_inline', createDollarInlineRule(resolved))
    md.block.ruler.after('blockquote', 'math_block', createDollarBlockRule(resolved), {
      alt: [...BLOCK_ALT],
    })
  }
  if (brackets) {
    // `(`/`[` are in the escape rule's set — bracket delimiters must run first.
    md.inline.ruler.before('escape', 'math_inline_bracket', createBracketInlineRule())
    md.block.ruler.after('blockquote', 'math_block_bracket', createBracketBlockRule(resolved), {
      alt: [...BLOCK_ALT],
    })
  }

  md.renderer.rules['math_inline'] = wrapper.math_inline
  md.renderer.rules['math_inline_display'] = wrapper.math_inline_display
  md.renderer.rules['math_block'] = wrapper.math_block

  if (resolved.mathFence) {
    const origFence = md.renderer.rules['fence']
    md.renderer.rules['fence'] = function (tokens, idx, opts, env, self) {
      const token = tokens[idx]!
      const lang = token.info.trim().split(/\s+/, 1)[0]
      if (lang === 'math') return wrapper.renderBlock(token.content.replace(/\n$/, ''), env)
      return origFence ? origFence.call(this, tokens, idx, opts, env, self) : ''
    }
  }

  const origAsText = md.renderer.renderInlineAsText.bind(md.renderer)
  md.renderer.renderInlineAsText = (tokens, opts, env) =>
    origAsText(tokens.map(asTextToken), opts, env)

  if (renderer.reset) {
    // Runs at the end of the core chain — after parsing, before any renderer
    // rule fires — once per full render. Keeps pages (and HMR updates)
    // independent: AMS numbering, `\gdef` macros, label registries.
    md.core.ruler.push('vpm_reset', (state) => {
      if (!(state as { inlineMode?: boolean }).inlineMode) renderer.reset!()
    })
  }
}
