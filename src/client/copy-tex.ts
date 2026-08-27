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
  /**
   * A formula to copy when there is no usable selection — the dblclick
   * handler's marked element. SVG output holds no selectable text, so the
   * browser may collapse the selection after a double-click; the mark keeps
   * copy working regardless. With no marked formula, the copy handler falls
   * back to the focused wrapper (display math is tabindex-focusable, so
   * Tab + Ctrl/Cmd+C copies its TeX).
   */
  fallbackRoot?: () => Element | null
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

/**
 * Whether a formula's rendered output holds no selectable text, so the
 * browser's own selection gestures cannot grab it. True only for MathJax's
 * SVG output (`mjx-container` with `jax="SVG"` / a direct `<svg>` child —
 * KaTeX also embeds svg for stretchy glyphs, but inside selectable HTML).
 * KaTeX, Temml, and MathJax CHTML render selectable DOM: they keep native
 * selection gestures, and only the copy handler rewrites the clipboard.
 */
function needsAssistedSelection(root: Element): boolean {
  const container = root.matches('mjx-container') ? root : root.querySelector('mjx-container')
  if (!container) return false
  if (container.getAttribute('jax') === 'SVG') return true
  const child = container.firstElementChild
  return !!child && child.tagName.toLowerCase() === 'svg'
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

/** Whether `fragment` holds a math root satisfying `match`. */
function hasRoot(
  fragment: DocumentFragment,
  roots: readonly string[],
  match: (root: Element) => boolean,
): boolean {
  for (const selector of roots) {
    for (const el of fragment.querySelectorAll(selector)) {
      if (match(el)) return true
    }
  }
  return false
}

/**
 * Serializes a fragment as HTML markup. Goes through a detached element
 * rather than concatenating `outerHTML`, so top-level text is escaped and
 * comment nodes keep their syntax.
 */
function serializeFragment(fragment: DocumentFragment): string {
  const holder = document.createElement('div')
  holder.append(fragment.cloneNode(true)) // a fragment is emptied by append
  return holder.innerHTML
}

export interface DblclickSelectHandle {
  handleDblclick(event: MouseEvent): void
  /**
   * Suppresses the browser's select-word gesture over math (`detail >= 2`),
   * so no transient native selection flashes before ours applies. Attach to
   * `mousedown` (not `pointerdown`, whose preventDefault would cancel the
   * compatibility mouse events and with them the dblclick itself).
   */
  handleMouseDown(event: MouseEvent): void
  /** Drops the `vpm-selected` mark once the selection leaves the formula. */
  handleSelectionChange(): void
  /** Drops the mark when the pointer goes down outside the formula. */
  handlePointerDown(event: PointerEvent | MouseEvent): void
  /** Escape dismisses the mark (and the math selection backing it). */
  handleKeydown(event: KeyboardEvent): void
  /**
   * Touch long-press on a formula selects it (iOS's own long-press finds no
   * text inside SVG output and grabs neighboring prose instead). Wire
   * touchstart/touchmove/touchend/touchcancel.
   */
  handleTouchStart(event: TouchEvent): void
  handleTouchMove(event: TouchEvent): void
  handleTouchEnd(): void
  /** The currently marked formula, for the copy handler's fallback. */
  getMarked(): Element | null
  /** Removes any lingering mark (call on teardown). */
  clear(): void
}

/**
 * Chromium may fire native selection updates (collapsing the selection over
 * text-free SVG) shortly after dblclick — selection-based clearing is
 * ignored inside this window; explicit dismissal (pointerdown outside) is
 * not.
 */
const MARK_GRACE_MS = 500

/** Touch long-press duration before a formula is selected. */
const LONG_PRESS_MS = 400
/** Finger travel (px) that cancels a pending long-press. */
const LONG_PRESS_SLOP = 10
/** Gap (px) kept between the copy chip's center and the viewport edges. */
const CHIP_MARGIN = 8

async function copyText(text: string): Promise<boolean> {
  try {
    // Secure contexts only — on plain http (LAN dev servers) this throws
    // and the fallback below runs.
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // execCommand fallback, tuned for iOS Safari: `readOnly` keeps the
    // keyboard (and the resizing browser chrome) away, `preventScroll` plus
    // the scroll restore keep the viewport still, and 16px dodges input
    // auto-zoom. `setSelectionRange` rather than `select()`, which focuses
    // the textarea with scrolling.
    const x = window.scrollX
    const y = window.scrollY
    const active = document.activeElement
    const area = document.createElement('textarea')
    area.value = text
    area.readOnly = true
    area.style.position = 'fixed'
    area.style.top = '0'
    area.style.left = '0'
    area.style.opacity = '0'
    area.style.fontSize = '16px'
    document.body.append(area)
    let ok = false
    try {
      area.focus({ preventScroll: true })
      area.setSelectionRange(0, area.value.length)
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    area.remove()
    // Focusing the textarea took focus off whatever had it — hand it back.
    if (active instanceof HTMLElement) active.focus({ preventScroll: true })
    if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y)
    return ok
  }
}

/**
 * Assisted selection for formulas the browser cannot select on its own
 * (MathJax SVG output). Double-click (mouse) selects the whole formula and
 * marks it with a `vpm-selected` overlay, so a plain copy grabs its TeX;
 * double-tap / long-press (touch) marks it and offers a "Copy TeX" chip
 * instead, never touching the OS selection UI. Formulas rendered as
 * selectable DOM (KaTeX, Temml, MathJax CHTML) are left to the browser's
 * native gestures — only the copy handler rewrites their clipboard text.
 */
export function createDblclickSelectHandler(options: CopyTexOptions = {}): DblclickSelectHandle {
  const roots = options.roots ?? DEFAULT_ROOTS
  const delimiters = options.delimiters ?? DEFAULT_DELIMITERS
  let marked: Element | null = null
  let markedAt = 0
  /** Whether the mark came with a DOM selection (mouse dblclick path). */
  let markedWithSelection = false
  let chip: HTMLButtonElement | null = null
  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let pressStart: { x: number; y: number } | null = null
  /** Pointer type of the most recent pointerdown — routes dblclick. */
  let lastPointerType = 'mouse'

  const clear = () => {
    marked?.classList.remove('vpm-selected')
    marked = null
    chip?.remove()
    chip = null
    window.removeEventListener('resize', clear)
    window.removeEventListener('orientationchange', clear)
  }

  const cancelPress = () => {
    if (pressTimer !== null) clearTimeout(pressTimer)
    pressTimer = null
    pressStart = null
  }

  const mark = (root: Element, withSelection: boolean) => {
    clear()
    root.classList.add('vpm-selected')
    marked = root
    markedAt = Date.now()
    markedWithSelection = withSelection
  }

  const select = (root: Element) => {
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.selectNode(root)
    selection.removeAllRanges()
    selection.addRange(range)
    mark(root, true)
  }

  // Touch path: no DOM selection at all — that would summon the OS's own
  // selection UI on top of ours. A tap on the chip is a user gesture, so
  // the Clipboard API works directly.
  const markWithChip = (root: Element) => {
    mark(root, false)
    const rect = root.getBoundingClientRect()
    chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'vpm-copy-chip'
    // The label swaps to "Copied!" in place — announce that to screen
    // readers. aria-live (not role="status") keeps the element's button role.
    chip.setAttribute('aria-live', 'polite')
    chip.textContent = 'Copy TeX'
    // The chip is centered on its `left` (translate(-50%)); keep that center
    // inside the viewport so a formula at either edge stays reachable.
    const center = Math.min(
      Math.max(rect.left + rect.width / 2, CHIP_MARGIN),
      window.innerWidth - CHIP_MARGIN,
    )
    chip.style.left = `${center + window.scrollX}px`
    chip.style.top = `${rect.top + window.scrollY}px`
    // The chip sits at page coordinates taken once, so any reflow (rotation,
    // window resize, sidebar toggle) strands it — dismiss instead. Plain
    // scrolling moves the page and the chip together and is left alone.
    window.addEventListener('resize', clear)
    window.addEventListener('orientationchange', clear)
    chip.addEventListener('click', () => {
      const tex = texOf(root)
      if (tex === null || !chip) return
      const [open, close] = isDisplayMath(root) ? delimiters.display : delimiters.inline
      const el = chip
      void copyText(open + tex + close).then((ok) => {
        el.textContent = ok ? 'Copied!' : 'Copy failed'
        setTimeout(clear, 900)
      })
    })
    document.body.append(chip)
  }

  return {
    handleMouseDown(event) {
      if (event.detail < 2) return
      const target = event.target
      if (!(target instanceof Element)) return
      const root = rootOf(target, roots)
      if (root && texOf(root) !== null && needsAssistedSelection(root)) event.preventDefault()
    },
    handleDblclick(event) {
      const target = event.target
      if (!(target instanceof Element)) return
      const root = rootOf(target, roots)
      if (!root || texOf(root) === null || !needsAssistedSelection(root)) return
      // Touch and stylus double-taps take the chip path: a DOM selection
      // would summon the OS selection UI, and the next tap would collapse it
      // (reading as dismissal). Mouse keeps the selection + Cmd+C flow.
      if (lastPointerType === 'touch' || lastPointerType === 'pen') {
        markWithChip(root)
        return
      }
      // The browser's own select-word action runs AFTER event dispatch; over
      // SVG there is no text, so it would collapse a selection made here.
      // Apply ours after the native action settles.
      setTimeout(() => select(root), 0)
    },
    handleTouchStart(event) {
      cancelPress()
      if (event.touches.length !== 1) return
      const touch = event.touches[0]!
      const target = event.target
      if (!(target instanceof Element)) return
      const root = rootOf(target, roots)
      if (!root || texOf(root) === null || !needsAssistedSelection(root)) return
      pressStart = { x: touch.clientX, y: touch.clientY }
      pressTimer = setTimeout(() => {
        pressTimer = null
        markWithChip(root)
      }, LONG_PRESS_MS)
    },
    handleTouchMove(event) {
      if (!pressStart) return
      const touch = event.touches[0]
      if (
        !touch ||
        Math.abs(touch.clientX - pressStart.x) > LONG_PRESS_SLOP ||
        Math.abs(touch.clientY - pressStart.y) > LONG_PRESS_SLOP
      ) {
        cancelPress()
      }
    },
    handleTouchEnd() {
      cancelPress()
    },
    handleSelectionChange() {
      // Chip-marked formulas (touch) have no backing selection — only
      // explicit dismissal removes them.
      if (!marked || !markedWithSelection || Date.now() - markedAt < MARK_GRACE_MS) return
      const selection = window.getSelection()
      // Range.intersectsNode, not Selection.containsNode — the latter
      // reports false in Chromium even for the exact selectNode() range.
      if (
        !selection ||
        selection.isCollapsed ||
        selection.rangeCount === 0 ||
        !selection.getRangeAt(0).intersectsNode(marked)
      ) {
        clear()
      }
    },
    handlePointerDown(event) {
      lastPointerType = (event as PointerEvent).pointerType || 'mouse'
      if (!marked) return
      const target = event.target
      if (!(target instanceof Node)) return
      if (marked.contains(target) || (chip && chip.contains(target))) return
      clear()
    },
    handleKeydown(event) {
      // No preventDefault/stopPropagation: a mark implies math context, and
      // letting Escape bubble keeps overlays (search modal, …) working.
      if (event.key !== 'Escape' || !marked) return
      if (markedWithSelection) {
        const selection = window.getSelection()
        if (
          selection &&
          !selection.isCollapsed &&
          selection.rangeCount > 0 &&
          selection.getRangeAt(0).intersectsNode(marked)
        ) {
          // Only the selection backing OUR mark — never an unrelated one.
          selection.removeAllRanges()
        }
      }
      clear()
    },
    // A page swap can detach the marked formula — a node out of the document
    // must never back the copy fallback.
    getMarked: () => (marked?.isConnected ? marked : null),
    clear,
  }
}

/**
 * Creates the handler for `copy` and `cut` (over a non-editable selection
 * `cut` behaves as a copy, so one handler serves both). Attach it to
 * `document` once — it is delegated, so it survives SPA navigation without
 * re-initialization.
 */
export function createCopyTexHandler(
  options: CopyTexOptions = {},
): (event: ClipboardEvent) => void {
  const roots = options.roots ?? DEFAULT_ROOTS
  const delimiters = options.delimiters ?? DEFAULT_DELIMITERS
  return (event) => {
    if (!event.clipboardData) return
    // Copying from a field (VitePress's search box, an editable demo) is the
    // field's business: the page selection reads as collapsed there, so the
    // fallback below would otherwise hijack the clipboard with a formula.
    const target = event.target
    if (
      target instanceof Element &&
      target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
    ) {
      return
    }
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      // No usable selection, but a formula is marked (dblclick over SVG
      // output, where the browser may have collapsed the selection) or
      // focused (Tab reaches display wrappers) — copy that formula.
      const fallback =
        options.fallbackRoot?.() ??
        (document.activeElement instanceof Element
          ? document.activeElement.closest('[data-tex]')
          : null)
      const tex = fallback ? texOf(fallback) : null
      if (!fallback || tex === null) return
      const [open, close] = isDisplayMath(fallback) ? delimiters.display : delimiters.inline
      event.clipboardData.setData('text/html', fallback.outerHTML)
      event.clipboardData.setData('text/plain', open + tex + close)
      event.preventDefault()
      return
    }
    if (options.container) {
      const container = options.container()
      if (!container || !container.contains(selection.anchorNode)) return
    }
    // Old Gecko splits a selection at `user-select: none` boundaries into one
    // range per run of selectable content — reading only the first would drop
    // everything past the first formula. Other engines report a single range,
    // so the loop degenerates to it.
    const fragments: DocumentFragment[] = []
    for (let i = 0; i < selection.rangeCount; i++) {
      // getRangeAt is LIVE — mutating it would visibly expand the user's
      // selection. Clone, then expand partial selections to whole formulas.
      const range = selection.getRangeAt(i).cloneRange()
      const startRoot = rootOf(range.startContainer, roots)
      if (startRoot) range.setStartBefore(startRoot)
      const endRoot = rootOf(range.endContainer, roots)
      if (endRoot) {
        // Chromium parks a triple-click's end boundary at offset 0 inside the
        // NEXT formula, where expanding would swallow one the user never
        // selected. Range.toString() is CSS-blind (unlike Selection's), so it
        // reports the text the boundary actually covers. A boundary parked at
        // the very start of the formula selects nothing of it. SVG output
        // holds no text, so an empty string there is inconclusive and the
        // formula stays included.
        const head = document.createRange()
        head.setStartBefore(endRoot)
        head.setEnd(range.endContainer, range.endOffset)
        if (head.toString() !== '' || needsAssistedSelection(endRoot)) range.setEndAfter(endRoot)
      }
      fragments.push(range.cloneContents())
    }
    const hasMath = fragments.some((fragment) =>
      hasRoot(fragment, roots, (root) => texOf(root) !== null),
    )
    if (!hasMath) return // no math — browser default

    // Rendered KaTeX/CHTML markup pastes as garbage into a rich editor: it
    // needs the engine's stylesheet to mean anything. There, the
    // TeX-substituted markup is the better rich flavor — prose formatting
    // survives and the math reads as `$…$`. MathJax's SVG output carries its
    // own geometry and pastes acceptably, so it keeps the rendered markup,
    // serialized before the substitution mutates the fragments.
    const keepRendered = fragments.some((fragment) =>
      hasRoot(fragment, roots, needsAssistedSelection),
    )
    const rendered = keepRendered ? fragments.map(serializeFragment).join('') : ''
    for (const fragment of fragments) replaceMathWithTex(fragment, options)
    event.clipboardData.setData(
      'text/html',
      keepRendered ? rendered : fragments.map(serializeFragment).join(''),
    )
    // Split ranges cover contiguous document text — joined with nothing.
    const text = fragments
      .map((fragment) => fragment.textContent ?? '')
      .join('')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+|\n+$/g, '')
    event.clipboardData.setData('text/plain', text)
    event.preventDefault()
  }
}
