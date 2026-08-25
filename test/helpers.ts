import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import MarkdownIt, { type Options as MarkdownItOptions, type PresetName } from 'markdown-it'
import { mathPlugin } from '../src/plugin.ts'
import type { MathMarkdownIt, MathOptions, MathRenderContext, MathRenderer } from '../src/types.ts'

/** `I` inline, `D` display block, `ID` display math sitting inside a paragraph. */
export function probeMarker(ctx: MathRenderContext): string {
  return ctx.display ? (ctx.inline ? 'ID' : 'D') : 'I'
}

/**
 * Engine-independent renderer: every expression becomes `[<mode>:<tex>]`, so
 * fixtures assert what the parser produced, never what an engine typeset.
 */
export function createProbeRenderer(name = 'probe'): MathRenderer {
  return { name, render: (tex, ctx) => `[${probeMarker(ctx)}:${tex}]` }
}

/** Probe renderer that also reports `ctx.label`: `[D#eq-1:x]`. */
export function createLabelProbeRenderer(name = 'probe-label'): MathRenderer {
  return {
    name,
    render: (tex, ctx) =>
      `[${probeMarker(ctx)}${ctx.label === undefined ? '' : `#${ctx.label}`}:${tex}]`,
  }
}

export interface TestMdOptions extends MathOptions {
  /** markdown-it constructor options (`html`, `linkify`, …). */
  markdownIt?: MarkdownItOptions
  /** markdown-it preset; defaults to `default`. */
  preset?: PresetName
  /** Engine adapter; defaults to {@link createProbeRenderer}. */
  renderer?: MathRenderer
}

/** A markdown-it instance with the math plugin installed. */
export function createMd(options: TestMdOptions = {}): MarkdownIt {
  const { markdownIt, preset, renderer, ...math } = options
  const md = new MarkdownIt(preset ?? 'default', markdownIt ?? {})
  mathPlugin(md as unknown as MathMarkdownIt, {
    ...math,
    renderer: renderer ?? createProbeRenderer(),
  })
  return md
}

/**
 * The single wrapper configuration every fixture is written against: no
 * `v-pre`, no `data-tex`, so the expected HTML stays about the parse, not the
 * attributes. The full attribute set has its own assertions in
 * `render.test.ts`.
 */
export const FIXTURE_MATH_OPTIONS: MathOptions = { vPre: false, copySource: false }

/** A markdown-it instance configured the way every fixture file expects. */
export function createFixtureMd(options: TestMdOptions = {}): MarkdownIt {
  return createMd({ ...FIXTURE_MATH_OPTIONS, ...options })
}

export interface Fixture {
  /** Case title (the fixture's first section). */
  name: string
  /** Markdown source. */
  input: string
  /** Expected HTML. */
  expected: string
  /** 1-based line the case starts on, for failure messages. */
  line: number
}

/**
 * Parses the `markdown-it-dollarmath` fixture format:
 *
 * ```text
 * name
 * .
 * input
 * .
 * expected html
 * .
 * ```
 *
 * Cases are separated by blank lines; a leading `<!-- … -->` block (the
 * per-file credit header) is skipped.
 */
export function parseFixtures(text: string): Fixture[] {
  const lines = text.split('\n')
  const fixtures: Fixture[] = []
  let i = 0

  const skipBlank = (): void => {
    while (i < lines.length && lines[i]!.trim() === '') i++
  }
  const section = (): string[] => {
    const collected: string[] = []
    while (i < lines.length && lines[i] !== '.') collected.push(lines[i++]!)
    i++ // the `.` terminator
    return collected
  }

  skipBlank()
  while (lines[i]?.startsWith('<!--')) {
    while (i < lines.length && !lines[i]!.includes('-->')) i++
    i++
    skipBlank()
  }

  while (i < lines.length) {
    skipBlank()
    if (i >= lines.length) break
    const line = i + 1
    const name = section().join(' ').trim()
    const input = section().join('\n')
    const expected = section().join('\n')
    if (name === '') throw new Error(`Fixture at line ${line} has no name`)
    fixtures.push({ name, input, expected, line })
  }
  return fixtures
}

/** Reads and parses `test/fixtures/<name>.md`. */
export function readFixtures(name: string): Fixture[] {
  const file = join(import.meta.dirname, 'fixtures', `${name}.md`)
  return parseFixtures(readFileSync(file, 'utf8'))
}
