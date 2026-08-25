/**
 * Engine-agnostic "copy as TeX": when a selection contains rendered math, the
 * plain-text clipboard gets the original TeX source in `$…$` / `$$…$$`
 * delimiters instead of the (garbled) rendered glyphs.
 *
 * Algorithm adapted from KaTeX's copy-tex extension (MIT © 2013–2020 Khan
 * Academy, extension by Eric Demaine) and Temml's variant (MIT © 2020 Ron
 * Kok) — see ACKNOWLEDGEMENTS.md — with fixes: the live selection range is
 * cloned before expansion, root selectors are probed outermost-first,
 * annotations are matched by encoding, display math keeps block boundaries,
 * and display delimiters are actually used.
 */

export interface CopyTexDelimiters {
  inline: readonly [string, string]
  display: readonly [string, string]
}

export interface CopyTexOptions {
  /** Delimiters wrapped around the extracted TeX. Defaults to `$`/`$$`. */
  delimiters?: CopyTexDelimiters
  /**
   * Selectors identifying a math root, probed one at a time in order (an
   * outer wrapper must come before the engine markup it contains — with a
   * single combined selector, `closest()` would return the nearest match
   * and leak the outer layers into the clipboard).
   */
  roots?: readonly string[]
  /** Restrict handling to selections inside this container. */
  container?: () => ParentNode | null
  /** Pad display math with newlines so it keeps its block boundaries. */
  blockNewlines?: boolean
}

const TEX_ANNOTATION = 'annotation[encoding="application/x-tex"]'

/** Our wrapper first, then engine-native roots (KaTeX, MathJax, MathML). */
const DEFAULT_ROOTS = ['[data-tex]', '.katex-display', '.katex', 'mjx-container', 'math'] as const

const DEFAULT_DELIMITERS: CopyTexDelimiters = { inline: ['$', '$'], display: ['$$', '$$'] }

function rootOf(node: Node, roots: readonly string[]): Element | null {
  const el = node.nodeType === 1 ? (node as Element) : node.parentElement
  if (!el) return null
  for (const selector of roots) {
    const hit = el.closest(selector)
    if (hit) return hit
  }
  return null
}

/** Extracts the TeX source of a math root element, or `null` if it has none. */
export function texOf(root: Element): string | null {
  const own = root.getAttribute('data-tex') // our wrapper — always wins
  if (own !== null) return own
  const annotation = root.querySelector(TEX_ANNOTATION) // KaTeX / Temml / MathML
  if (annotation) return annotation.textContent ?? ''
  const latex = root.querySelector('[data-latex]') // MathJax v3/v4
  if (latex) return latex.getAttribute('data-latex')
  return null
}

/** Whether a math root is display (block) math. */
export function isDisplayMath(root: Element): boolean {
  const display = root.getAttribute('data-display')
  if (display !== null) return display !== 'false'
  if (root.classList.contains('katex-display')) return true
  const tag = root.tagName.toLowerCase()
  if (tag === 'mjx-container') return root.getAttribute('display') === 'true'
  const math = tag === 'math' ? root : root.querySelector('math')
  return !!math && math.getAttribute('display') === 'block'
}

/** Replaces every math root inside `fragment` with its delimited TeX text. */
export function replaceMathWithTex(
  fragment: DocumentFragment,
  options: CopyTexOptions = {},
): DocumentFragment {
  const delimiters = options.delimiters ?? DEFAULT_DELIMITERS
  const roots = options.roots ?? DEFAULT_ROOTS
  for (const selector of roots) {
    for (const root of fragment.querySelectorAll(selector)) {
      if (!root.parentNode) continue // already consumed by an outer root
      const tex = texOf(root)
      if (tex === null) continue
      const display = isDisplayMath(root)
      const [open, close] = display ? delimiters.display : delimiters.inline
      const pad = display && options.blockNewlines !== false ? '\n' : ''
      root.replaceWith(new Text(pad + open + tex + close + pad))
    }
  }
  return fragment
}

function hasMath(fragment: DocumentFragment, roots: readonly string[]): boolean {
  for (const selector of roots) {
    for (const el of fragment.querySelectorAll(selector)) {
      if (texOf(el) !== null) return true
    }
  }
  return false
}

/**
 * Creates the `copy` event handler. Attach it to `document` once — it is
 * delegated, so it survives SPA navigation without re-initialization.
 */
export function createCopyTexHandler(
  options: CopyTexOptions = {},
): (event: ClipboardEvent) => void {
  const roots = options.roots ?? DEFAULT_ROOTS
  return (event) => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !event.clipboardData) return
    if (options.container) {
      const container = options.container()
      if (!container || !container.contains(selection.anchorNode)) return
    }
    // getRangeAt(0) is LIVE — mutating it would visibly expand the user's
    // selection. Clone, then expand partial selections to whole formulas.
    const range = selection.getRangeAt(0).cloneRange()
    const startRoot = rootOf(range.startContainer, roots)
    if (startRoot) range.setStartBefore(startRoot)
    const endRoot = rootOf(range.endContainer, roots)
    if (endRoot) range.setEndAfter(endRoot)
    const fragment = range.cloneContents()
    if (!hasMath(fragment, roots)) return // no math — browser default

    const html = Array.from(fragment.childNodes)
      .map((node) => (node.nodeType === 3 ? node.textContent : (node as Element).outerHTML))
      .join('')
    event.clipboardData.setData('text/html', html)
    const text = (replaceMathWithTex(fragment, options).textContent ?? '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+|\n+$/g, '')
    event.clipboardData.setData('text/plain', text)
    event.preventDefault()
  }
}
