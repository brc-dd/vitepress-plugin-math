// Internal ambient typings for engine packages that ship without them.
// This file is typecheck-only — it is not part of the published build, and
// no public signature may reference these modules' types.

declare module 'mathjax' {
  export interface MathJaxAdaptor {
    outerHTML(node: unknown): string
    cssText(node: unknown): string
  }

  export interface MathJaxInstance {
    tex2chtml(tex: string, options?: Record<string, unknown>): unknown
    tex2svg(tex: string, options?: Record<string, unknown>): unknown
    tex2mml(tex: string, options?: Record<string, unknown>): string
    chtmlStylesheet(): unknown
    svgStylesheet(): unknown
    texReset(): void
    done?(): Promise<void>
    startup: {
      adaptor: MathJaxAdaptor
      output: {
        clearCache?(): void
        clearFontCache?(): void
        font?: { loadDynamicFiles?(): Promise<unknown> }
      }
    }
  }

  export function init(config: Record<string, unknown>): Promise<MathJaxInstance>

  const MathJax: { init: typeof init }
  export default MathJax
}

declare module 'katex/contrib/mhchem' {
  // Side-effect module: registers `\ce`/`\pu` on the katex import.
}

declare module 'temml/dist/temmlPostProcess.js' {
  /** Fills in Temml's `\ref`/`\eqref` anchors client-side. Idempotent. */
  export function postProcess(root: Element): void
}
