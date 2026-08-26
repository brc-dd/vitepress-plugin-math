export const DOLLAR = 0x24
export const BACKSLASH = 0x5c
export const PAREN_OPEN = 0x28
export const PAREN_CLOSE = 0x29
export const BRACKET_OPEN = 0x5b
export const BRACKET_CLOSE = 0x5d
export const BACKTICK = 0x60

export function isAsciiDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39
}

/** Unicode-aware whitespace (matches `md.utils.isWhiteSpace`, incl. NBSP). */
export function isWhiteSpace(code: number): boolean {
  if (code >= 0x2000 && code <= 0x200a) return true
  switch (code) {
    case 0x09:
    case 0x0a:
    case 0x0b:
    case 0x0c:
    case 0x0d:
    case 0x20:
    case 0xa0:
    case 0x1680:
    case 0x202f:
    case 0x205f:
    case 0x3000:
      return true
    default:
      return false
  }
}

const WORDLIKE_RE = /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{N}_]/u

/**
 * A character that binds to an adjacent `$` tightly enough to rule out a math
 * delimiter — `cost$5`, `café$x$`, `x_1$…`. Letters of alphabetic scripts
 * that use word spacing (Latin/Greek/Cyrillic, so accented letters behave
 * like ASCII ones), digits of any script, and `_`. CJK and other
 * space-less scripts are deliberately excluded: `价格$x$` must stay math,
 * because those scripts never put a space before an inline formula.
 */
export function isWordLike(code: number): boolean {
  // Fast path: ASCII.
  if (code < 0x80) {
    return (
      (code >= 0x30 && code <= 0x39) ||
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a) ||
      code === 0x5f
    )
  }
  return WORDLIKE_RE.test(String.fromCodePoint(code))
}

/**
 * `true` when the character at `pos` is preceded by an odd number of
 * backslashes (i.e. it is escaped).
 */
export function isEscaped(src: string, pos: number): boolean {
  let p = pos - 1
  while (p >= 0 && src.charCodeAt(p) === BACKSLASH) p--
  return (pos - p) % 2 === 0
}
