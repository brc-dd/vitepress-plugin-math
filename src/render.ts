import type {
  MathEnv,
  MathMarkdownIt,
  MathPluginOptions,
  MathRenderContext,
  MathRenderRule,
} from './types.ts'

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  // @webc.site/math throws raw arrays like `[4, "\\ce"]`.
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export interface WrapperRenderer {
  math_inline: MathRenderRule
  math_inline_display: MathRenderRule
  math_block: MathRenderRule
  /** Renders fence/block content given raw TeX (used by the fence hook). */
  renderBlock(tex: string, env: MathEnv, label?: string): string
}

export function createWrapperRenderer(
  md: MathMarkdownIt,
  options: Required<Omit<MathPluginOptions, 'transformTex' | 'renderer'>> &
    Pick<MathPluginOptions, 'transformTex' | 'renderer'>,
): WrapperRenderer {
  const { escapeHtml } = md.utils
  const { renderer, vPre, copySource, throwOnError, transformTex } = options

  function render(tex: string, ctx: MathRenderContext): string {
    const { display, inline } = ctx
    const tag = display && !inline ? 'div' : 'span'
    let classes = display ? 'vpm vpm-display' : 'vpm vpm-inline'
    if (display && inline) classes += ' vpm-display-inline'

    let body: string | undefined
    let error: unknown
    try {
      const source = transformTex ? transformTex(tex, ctx) : tex
      body = renderer.render(source, ctx)
    } catch (thrown) {
      if (throwOnError) throw thrown
      error = thrown
      classes += ' vpm-error'
    }

    const attrs: string[] = [`class="${classes}"`]
    // A `$$…$$ (label)` label becomes a deep-linkable anchor.
    if (ctx.label !== undefined) attrs.push(`id="${escapeHtml(ctx.label)}"`)
    if (vPre) attrs.push('v-pre')
    if (display) attrs.push('data-display="true"')
    if (display && !inline) attrs.push('tabindex="0"')
    if (copySource) attrs.push(`data-tex="${escapeHtml(tex)}"`)
    if (body === undefined) {
      attrs.push(`title="${escapeHtml(formatError(error))}"`)
      const delim = display ? '$$' : '$'
      body = escapeHtml(delim + tex + delim)
    }

    return `<${tag} ${attrs.join(' ')}>${body}</${tag}>`
  }

  const renderBlock = (tex: string, env: MathEnv, label?: string): string =>
    render(tex, {
      display: true,
      inline: false,
      env,
      ...(label !== undefined ? { label } : {}),
    }) + '\n'

  return {
    math_inline: (tokens, idx, _options, env) =>
      render(tokens[idx]!.content, { display: false, inline: false, env }),
    math_inline_display: (tokens, idx, _options, env) =>
      render(tokens[idx]!.content, { display: true, inline: true, env }),
    math_block: (tokens, idx, _options, env) => {
      const token = tokens[idx]!
      const label = token.meta?.['label']
      return renderBlock(token.content, env, typeof label === 'string' ? label : undefined)
    },
    renderBlock,
  }
}
