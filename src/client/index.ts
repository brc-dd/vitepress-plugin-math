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
   * Double-clicking a formula selects the whole formula, so a plain copy
   * grabs its TeX. Without this, engines whose rendered output has no
   * selectable text (MathJax SVG) cannot be copied on their own — only as
   * part of a larger selection.
   * @default true
   */
  selectOnDblclick?: boolean
}

/**
 * Copy-as-TeX for rendered math: selections containing formulas put the
 * original TeX (in `$…$`/`$$…$$`) on the plain-text clipboard.
 *
 * SSR-safe — no browser globals at import time; one delegated `document`
 * listener installed in `onMounted`, so it survives SPA navigation. Call it
 * from a wrapping Layout component's `<script setup>` (VitePress's
 * `Theme.setup()` is deprecated, and `enhanceApp` runs during the SSR
 * build):
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
      document.addEventListener('dblclick', select.handleDblclick)
      document.addEventListener('selectionchange', select.handleSelectionChange)
      document.addEventListener('pointerdown', select.handlePointerDown)
    }
    const marked = select
    copy = createCopyTexHandler({
      ...options,
      ...(marked ? { fallbackRoot: () => marked.getMarked() } : {}),
    })
    document.addEventListener('copy', copy)
  })
  onUnmounted(() => {
    if (copy) document.removeEventListener('copy', copy)
    if (select) {
      document.removeEventListener('dblclick', select.handleDblclick)
      document.removeEventListener('selectionchange', select.handleSelectionChange)
      document.removeEventListener('pointerdown', select.handlePointerDown)
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
 */
export function useTemmlRefs(): void {
  onContentUpdated(async () => {
    const { postProcess } = await import('temml/dist/temmlPostProcess.js')
    postProcess(document.body)
  })
}
