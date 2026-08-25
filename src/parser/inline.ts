import type { MathInlineRule, MathStateInline } from '../types.ts'
import {
  BACKSLASH,
  BRACKET_OPEN,
  DOLLAR,
  PAREN_OPEN,
  isAsciiDigit,
  isEscaped,
  isWhiteSpace,
  isWordLike,
} from './chars.ts'

export interface InlineRuleOptions {
  allowInlineWithSpace: boolean
  inlineDisplay: boolean
}

/**
 * `$…$` and mid-paragraph `$$…$$`.
 *
 * Parser lineage: the charCode scanning approach descends from
 * markdown-it-katex (MIT © 2016 Waylon Flinn) via \@mdit/plugin-tex
 * (MIT © 2022-present Mr.Hope) — see ACKNOWLEDGEMENTS.md.
 */
export function createDollarInlineRule(options: InlineRuleOptions): MathInlineRule {
  const { allowInlineWithSpace, inlineDisplay } = options

  function scanDouble(state: MathStateInline, silent: boolean): boolean {
    const { src, posMax } = state
    const start = state.pos
    let from = start + 2
    let match = -1
    while ((match = src.indexOf('$$', from)) !== -1) {
      // Both closer chars must sit inside the current inline scope — never
      // scan across a link/image label boundary.
      if (match + 1 >= posMax) {
        match = -1
        break
      }
      if (isEscaped(src, match)) {
        from = match + 1
        continue
      }
      break
    }
    if (match === -1 || match === start + 2) {
      // Unclosed or empty (`$$$$`) — emit the pair literally.
      if (!silent) state.pending += '$$'
      state.pos = start + 2
      return true
    }
    if (!silent) {
      const token = state.push('math_inline_display', 'math', 0)
      token.markup = '$$'
      token.content = src.slice(start + 2, match)
    }
    state.pos = match + 2
    return true
  }

  return (state, silent) => {
    const { src, posMax } = state
    const start = state.pos
    if (src.charCodeAt(start) !== DOLLAR) return false

    if (start + 1 < posMax && src.charCodeAt(start + 1) === DOLLAR) {
      if (!inlineDisplay) return false
      return scanDouble(state, silent)
    }

    const prev = start > 0 ? src.charCodeAt(start - 1) : -1
    const next = start + 1 < posMax ? src.charCodeAt(start + 1) : -1
    if (
      next === -1 ||
      prev === DOLLAR ||
      (prev !== -1 && isWordLike(prev)) ||
      (!allowInlineWithSpace && isWhiteSpace(next))
    ) {
      // Not a valid opener (`cost$…`, `$ x`, trailing `$`) — literal dollar.
      if (!silent) state.pending += '$'
      state.pos = start + 1
      return true
    }

    let from = start + 1
    let match = -1
    while ((match = src.indexOf('$', from)) !== -1) {
      if (match >= posMax) {
        match = -1
        break
      }
      if (isEscaped(src, match)) {
        from = match + 1
        continue
      }
      const closePrev = src.charCodeAt(match - 1)
      const closeNext = match + 1 < posMax ? src.charCodeAt(match + 1) : -1
      if (!allowInlineWithSpace && isWhiteSpace(closePrev)) {
        if (closeNext === -1 || isWhiteSpace(closeNext)) {
          // `$\text{a $ b}$` — a `$` with whitespace on both sides is a
          // literal dollar inside the math; keep scanning.
          from = match + 1
          continue
        }
        // `$1 $c$` — this may be the opener of a separate expression.
        match = -1
        break
      }
      if (closeNext !== -1 && isAsciiDigit(closeNext)) {
        // `$x$5` — a digit stuck to the closer reads as currency, not math.
        // Abort the whole attempt (scanning on would swallow the prose in
        // `$x$5 and 5$x$` into one bogus expression).
        match = -1
        break
      }
      break
    }

    if (match === -1) {
      if (!silent) state.pending += '$'
      state.pos = start + 1
      return true
    }

    if (!silent) {
      const token = state.push('math_inline', 'math', 0)
      token.markup = '$'
      token.content = src.slice(start + 1, match)
    }
    state.pos = match + 1
    return true
  }
}

/**
 * `\(…\)` (inline) and mid-paragraph `\[…\]` (display). Must be registered
 * BEFORE the `escape` rule: `(` and `[` are in its escape set, so it would
 * otherwise consume the opener first.
 */
export function createBracketInlineRule(): MathInlineRule {
  return (state, silent) => {
    const { src, posMax } = state
    const start = state.pos
    if (src.charCodeAt(start) !== BACKSLASH || start + 1 >= posMax) return false
    const open = src.charCodeAt(start + 1)
    if (open !== PAREN_OPEN && open !== BRACKET_OPEN) return false
    if (isEscaped(src, start)) return false

    const display = open === BRACKET_OPEN
    const closer = display ? '\\]' : '\\)'
    let from = start + 2
    let match = -1
    while ((match = src.indexOf(closer, from)) !== -1) {
      if (match + 1 >= posMax) {
        match = -1
        break
      }
      if (isEscaped(src, match)) {
        from = match + 1
        continue
      }
      break
    }
    // Unclosed — let the `escape` rule render `\(` as a literal `(`.
    if (match === -1) return false

    if (!silent) {
      const token = state.push(display ? 'math_inline_display' : 'math_inline', 'math', 0)
      token.markup = display ? '\\[' : '\\('
      token.content = src.slice(start + 2, match)
    }
    state.pos = match + 2
    return true
  }
}
