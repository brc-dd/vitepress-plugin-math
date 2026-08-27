/// <reference path="../engines/engine-shims.d.ts" />
import { onContentUpdated } from 'vitepress'
import { onMounted, onUnmounted } from 'vue'
import type { CopyTexOptions } from './copy-tex.ts'
import { createCopyTexHandler, createDblclickSelectHandler } from './copy-tex.ts'

export {
  createCopyTexHandler,
  createDblclickSelectHandler,
  isDisplayMath,
  replaceMathWithTex,
  texOf,
} from './copy-tex.ts'
export type { CopyTexDelimiters, CopyTexOptions } from './copy-tex.ts'

export interface UseCopyTexOptions extends CopyTexOptions {
  /**
   * Assisted selection for SVG-rendered math (MathJax's default output),
   * which holds no selectable text: double-click selects + highlights the
   * whole formula, double-tap / long-press shows a "Copy TeX" chip on
   * touch. Engines rendering selectable DOM (KaTeX, Temml, MathJax CHTML)
   * are never affected — they keep native selection gestures. Disable if
   * you want plain browser behavior everywhere.
   * @default true
   */
  selectOnDblclick?: boolean
}

/**
 * Copy-as-TeX for rendered math: selections containing formulas put the
 * original TeX (in `$…$`/`$$…$$`) on the plain-text clipboard.
 *
 * The Vite plugin calls this for you — `math()` wraps the site's theme entry
 * and starts it there. Wire it yourself only under `inject: false`, or
 * outside VitePress.
 *
 * SSR-safe — no browser globals at import time; delegated `document`
 * listeners installed in `onMounted`, so they survive SPA navigation. Called
 * by hand, it belongs in a wrapping Layout component's `<script setup>`
 * (`enhanceApp` runs during the SSR build, too early for composables):
 *
 * ```vue
 * <script setup>
 * import DefaultTheme from 'vitepress/theme'
 * import { useCopyTex } from 'vitepress-plugin-math/client'
 * useCopyTex()
 * </script>
 * <template><DefaultTheme.Layout /></template>
 * ```
 */
export function useCopyTex(options: UseCopyTexOptions = {}): void {
  let copy: ((event: ClipboardEvent) => void) | null = null
  let select: ReturnType<typeof createDblclickSelectHandler> | null = null
  onMounted(() => {
    if (options.selectOnDblclick !== false) {
      select = createDblclickSelectHandler(options)
      document.addEventListener('mousedown', select.handleMouseDown)
      document.addEventListener('dblclick', select.handleDblclick)
      document.addEventListener('selectionchange', select.handleSelectionChange)
      document.addEventListener('pointerdown', select.handlePointerDown)
      document.addEventListener('keydown', select.handleKeydown)
      document.addEventListener('touchstart', select.handleTouchStart, { passive: true })
      document.addEventListener('touchmove', select.handleTouchMove, { passive: true })
      document.addEventListener('touchend', select.handleTouchEnd)
      document.addEventListener('touchcancel', select.handleTouchEnd)
    }
    const marked = select
    copy = createCopyTexHandler({
      ...options,
      ...(marked ? { fallbackRoot: () => marked.getMarked() } : {}),
    })
    document.addEventListener('copy', copy)
    // `cut` over a non-editable selection behaves as a copy — same handler.
    document.addEventListener('cut', copy)
  })
  // A page swap leaves the mark and its chip behind, floating over new
  // content and pointing at a detached formula.
  onContentUpdated(() => select?.clear())
  onUnmounted(() => {
    if (copy) {
      document.removeEventListener('copy', copy)
      document.removeEventListener('cut', copy)
    }
    if (select) {
      document.removeEventListener('mousedown', select.handleMouseDown)
      document.removeEventListener('dblclick', select.handleDblclick)
      document.removeEventListener('selectionchange', select.handleSelectionChange)
      document.removeEventListener('pointerdown', select.handlePointerDown)
      document.removeEventListener('keydown', select.handleKeydown)
      document.removeEventListener('touchstart', select.handleTouchStart)
      document.removeEventListener('touchmove', select.handleTouchMove)
      document.removeEventListener('touchend', select.handleTouchEnd)
      document.removeEventListener('touchcancel', select.handleTouchEnd)
      select.clear()
    }
    copy = select = null
  })
}

/**
 * Resolves Temml `\ref`/`\eqref` cross-references. Temml renders them as
 * empty anchors at build time — only its client `postProcess` fills in the
 * equation numbers. Imports the 1 KB standalone module (not the full
 * engine), re-running on every page's content update. Only needed with the
 * Temml engine, and only when pages use `\ref`/`\eqref`.
 *
 * The Vite plugin calls this for you under the Temml engine; wire it yourself
 * only under `inject: false`, or outside VitePress.
 */
export function useTemmlRefs(): void {
  onContentUpdated(async () => {
    const { postProcess } = await import('temml/dist/temmlPostProcess.js')
    postProcess(document.body)
  })
}
