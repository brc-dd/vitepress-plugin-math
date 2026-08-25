/**
 * Structural typings for the slice of markdown-it we touch.
 *
 * markdown-it v14 ships types via `@types/markdown-it` while v15 bundles its
 * own with a different import surface (`markdown-it/lib/*` is gone). Typing
 * against a minimal structural contract keeps the plugin compatible with the
 * instance VitePress hands us (its bundled markdown-it) on both majors.
 */

export interface MathToken {
  type: string
  tag: string
  content: string
  markup: string
  info: string
  map: [number, number] | null
  block: boolean
  level: number
  meta?: Record<string, unknown> | null
  children?: MathToken[] | null
  attrGet(name: string): string | null
  attrSet(name: string, value: string): void
}

export interface MathStateInline {
  src: string
  env: MathEnv
  pos: number
  posMax: number
  pending: string
  tokens: MathToken[]
  push(type: string, tag: string, nesting: number): MathToken
  md: MathMarkdownIt
}

export interface MathStateBlock {
  src: string
  env: MathEnv
  line: number
  lineMax: number
  blkIndent: number
  bMarks: number[]
  eMarks: number[]
  tShift: number[]
  sCount: number[]
  tokens: MathToken[]
  getLines(begin: number, end: number, indent: number, keepLastLF: boolean): string
  push(type: string, tag: string, nesting: number): MathToken
  md: MathMarkdownIt
}

export type MathInlineRule = (state: MathStateInline, silent: boolean) => boolean
export type MathBlockRule = (
  state: MathStateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
) => boolean

export type MathRenderRule = (
  tokens: MathToken[],
  idx: number,
  options: unknown,
  env: MathEnv,
  self: unknown,
) => string

export interface MathMarkdownIt {
  inline: {
    ruler: {
      after(afterName: string, ruleName: string, rule: MathInlineRule): void
      before(beforeName: string, ruleName: string, rule: MathInlineRule): void
    }
  }
  block: {
    ruler: {
      after(
        afterName: string,
        ruleName: string,
        rule: MathBlockRule,
        options?: { alt: string[] },
      ): void
    }
  }
  core: {
    ruler: {
      push(ruleName: string, rule: (state: { env: MathEnv }) => void): void
    }
  }
  renderer: {
    rules: Record<string, MathRenderRule | undefined>
    renderInlineAsText(tokens: MathToken[], options: unknown, env: MathEnv): string
  }
  utils: {
    escapeHtml(str: string): string
    isWhiteSpace(code: number): boolean
  }
}

/** The `env` object markdown-it threads through a render. Opaque to us. */
export type MathEnv = Record<string, unknown> | undefined

/** Context handed to a renderer for a single expression. */
export interface MathRenderContext {
  /** `true` for display (block) mode, `false` for inline mode. */
  display: boolean
  /**
   * `true` when display math appears mid-paragraph (`a $$x$$ b`). The engine
   * still renders in display mode; only our wrapper differs (inline-legal).
   */
  inline: boolean
  /** Equation label parsed from `$$…$$ (label)`, when `labels` is enabled. */
  label?: string
  /** The markdown-it `env` for the current render (page). */
  env: MathEnv
}

/**
 * The engine contract. Anything that can turn TeX into HTML synchronously can
 * back this plugin — the built-in adapters (MathJax, KaTeX, Temml,
 * \@webc.site/math) do their async setup in their factory and render sync.
 */
export interface MathRenderer {
  /** Engine identifier used in class names and diagnostics (e.g. `katex`). */
  name: string
  /**
   * Render one TeX expression to an HTML string. The result is embedded in
   * the plugin's own wrapper element (which carries `v-pre`/`data-tex`), so
   * it must not rely on outer delimiters. Renderers own the escaping of
   * their output — the plugin inserts it verbatim.
   */
  render(tex: string, ctx: MathRenderContext): string
  /**
   * Reset per-document state (AMS equation numbers, `\label` registries,
   * `\gdef` macros …). Called once at the start of every markdown render so
   * pages are independent and HMR never accumulates state.
   */
  reset?(): void
  /**
   * CSS for everything rendered so far, when the engine generates styles at
   * runtime (MathJax). Font-file URLs inside it are resolved by the Vite
   * plugin.
   */
  stylesheet?(): string
  /** Release resources at the end of a build (e.g. MathJax worker threads). */
  finalize?(): void | Promise<void>
}

export type MathDelimiters = 'dollars' | 'brackets' | 'all'

export interface MathOptions {
  /**
   * Which TeX delimiters to parse.
   * - `dollars`: `$…$` and `$$…$$`
   * - `brackets`: `\(…\)` and `\[…\]`
   * - `all`: both
   * @default 'all'
   */
  delimiters?: MathDelimiters
  /**
   * Treat ```` ```math ```` fenced code blocks as display math.
   * @default true
   */
  mathFence?: boolean
  /**
   * Allow inline math delimited with surrounding spaces (`$ a $`). Off by
   * default, matching KaTeX/Pandoc conventions and avoiding currency
   * false-positives.
   * @default false
   */
  allowInlineWithSpace?: boolean
  /**
   * Parse `$$…$$` appearing mid-paragraph as display math rendered inline
   * (an inline-legal wrapper, so `a $$x$$ b` works instead of falling back
   * to literal text).
   * @default true
   */
  inlineDisplay?: boolean
  /**
   * Parse `$$…$$ (label)` trailing labels (MyST-style) into
   * `MathRenderContext.label`.
   * @default false
   */
  labels?: boolean
  /**
   * Add `v-pre` to wrapper elements so Vue leaves rendered math alone.
   * Required for VitePress; harmless elsewhere.
   * @default true
   */
  vPre?: boolean
  /**
   * Embed the TeX source as a `data-tex` attribute on the wrapper. Powers
   * copy-as-TeX and "view source" client features for every engine.
   * @default true
   */
  copySource?: boolean
  /**
   * Rethrow engine render errors instead of emitting an error placeholder
   * (`<span class="vpm-error">`).
   * @default false
   */
  throwOnError?: boolean
  /** Transform TeX source before it reaches the engine. */
  transformTex?: (tex: string, ctx: MathRenderContext) => string
}

export interface MathPluginOptions extends MathOptions {
  /** The engine adapter that turns TeX into HTML. */
  renderer: MathRenderer
}
