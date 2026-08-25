import type { MathBlockRule } from '../types.ts'
import { BACKSLASH, BRACKET_OPEN, DOLLAR, isEscaped } from './chars.ts'

export interface BlockRuleOptions {
  labels: boolean
}

const LABEL_RE = /[ \t]*\(([^)\s$]+)\)[ \t]*$/

interface Closer {
  /** Text on the closing line before the closing marker (dedented). */
  prefix: string
  label: string | undefined
}

/**
 * Returns closer info when `line` (already dedented) ends with the given
 * marker (plus an optional `(label)` when enabled), or `null`.
 */
function matchCloser(line: string, marker: string, allowLabel: boolean): Closer | null {
  let text = line.replace(/[ \t]+$/, '')
  let label: string | undefined
  if (allowLabel) {
    const m = LABEL_RE.exec(text)
    if (m) {
      label = m[1]
      text = text.slice(0, m.index).replace(/[ \t]+$/, '')
    }
  }
  if (!text.endsWith(marker)) return null
  const at = text.length - marker.length
  if (isEscaped(text, at)) return null
  // The closer must be the FIRST unescaped marker on the line — an earlier
  // one means multiple pairs (`$$A$$ $$B$$`), which belong to the paragraph
  // where the inline display rule renders each pair.
  let first = -1
  let from = 0
  while ((first = text.indexOf(marker, from)) !== -1) {
    if (isEscaped(text, first)) {
      from = first + 1
      continue
    }
    break
  }
  if (first !== at) return null
  return { prefix: text.slice(0, at).replace(/[ \t]+$/, ''), label }
}

function createBlockRule(tokenMarkup: '$$' | '\\[', options: BlockRuleOptions): MathBlockRule {
  const opener = tokenMarkup
  const closer = tokenMarkup === '$$' ? '$$' : '\\]'
  const openFirst = tokenMarkup === '$$' ? DOLLAR : BACKSLASH
  const openSecond = tokenMarkup === '$$' ? DOLLAR : BRACKET_OPEN
  const allowLabel = tokenMarkup === '$$' && options.labels

  return (state, startLine, endLine, silent) => {
    // Indented 4+ → code block territory.
    if (state.sCount[startLine]! - state.blkIndent >= 4) return false
    const pos = state.bMarks[startLine]! + state.tShift[startLine]!
    const max = state.eMarks[startLine]!
    if (pos + 2 > max) return false
    const { src } = state
    if (src.charCodeAt(pos) !== openFirst || src.charCodeAt(pos + 1) !== openSecond) return false
    if (opener === '\\[' && isEscaped(src, pos)) return false

    const firstRest = src.slice(pos + 2, max)
    // Continuation lines dedent relative to the OPENING line (like fences),
    // not the surrounding block indent.
    const indent = state.sCount[startLine]!

    // Single-line form: `$$content$$` with nothing after the closer.
    let contentParts: string[] | null = null
    let label: string | undefined
    let lastLine = startLine

    const single =
      firstRest.length >= closer.length ? matchCloser(firstRest, closer, allowLabel) : null
    if (single) {
      contentParts = [single.prefix]
      label = single.label
    } else {
      // Multi-line: scan for a line ending with the closing marker. A line
      // indented 4+ relative to the block can't close (it reads as code), a
      // dedent below the current block indent ends the search, and a blank
      // line makes the whole thing not-math (an unclosed `$$` must never
      // swallow the rest of the document).
      let line = startLine + 1
      let found: Closer | null = null
      for (; line < endLine; line++) {
        const lpos = state.bMarks[line]! + state.tShift[line]!
        if (lpos >= state.eMarks[line]!) return false // blank line
        if (state.sCount[line]! < state.blkIndent) return false // dedent
        if (state.sCount[line]! - state.blkIndent >= 4) continue
        const text = state.getLines(line, line + 1, indent, false)
        found = matchCloser(text, closer, allowLabel)
        if (found) break
      }
      if (!found) return false
      lastLine = line
      contentParts = []
      if (firstRest !== '') contentParts.push(firstRest)
      if (line > startLine + 1) {
        contentParts.push(state.getLines(startLine + 1, line, indent, false))
      }
      if (found.prefix !== '') contentParts.push(found.prefix)
      label = found.label
    }

    if (silent) return true

    state.line = lastLine + 1
    const token = state.push('math_block', 'math', 0)
    token.block = true
    token.content = contentParts.join('\n')
    token.markup = tokenMarkup
    token.map = [startLine, state.line]
    if (label !== undefined) token.meta = { ...token.meta, label }
    return true
  }
}

/**
 * `$$…$$` display math blocks, with optional trailing `(label)`.
 *
 * A `$$` line whose closer has trailing content (`$$x$$ and more`) is left to
 * the paragraph, where the inline display rule renders it — instead of
 * swallowing the trailing text into the TeX.
 */
export function createDollarBlockRule(options: BlockRuleOptions): MathBlockRule {
  return createBlockRule('$$', options)
}

/** `\[…\]` display math blocks. */
export function createBracketBlockRule(options: BlockRuleOptions): MathBlockRule {
  return createBlockRule('\\[', options)
}
