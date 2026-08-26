import type { MathRenderer } from '../types.ts'

/** Thrown when an optional engine peer dependency is not installed. */
export class EngineMissingError extends Error {
  override name = 'EngineMissingError'
  readonly engine: string
  readonly specifier: string

  constructor(engine: string, specifier: string) {
    super(
      `[vitepress-plugin-math] The "${engine}" engine needs the \`${specifier}\` package. ` +
        `Install it (e.g. \`pnpm add -D ${specifier}\`) or configure a different engine.`,
    )
    this.engine = engine
    this.specifier = specifier
  }
}

function isModuleNotFound(error: unknown, specifier: string): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as { code?: string }).code
  if (code !== 'ERR_MODULE_NOT_FOUND' && code !== 'MODULE_NOT_FOUND') return false
  // Only the engine package itself being absent counts — a missing transitive
  // dependency is a real error and must not be misreported as "not installed".
  return error.message.includes(`'${specifier}'`) || error.message.includes(`"${specifier}"`)
}

/**
 * Runs a dynamic engine import, mapping only "this exact package is not
 * installed" to `EngineMissingError`. Everything else (a crash inside the
 * engine, a broken transitive dep) is rethrown as-is.
 */
export async function loadEngine<T>(
  engine: string,
  specifier: string,
  load: () => Promise<T>,
): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (isModuleNotFound(error, specifier)) throw new EngineMissingError(engine, specifier)
    throw error
  }
}

/**
 * Wraps an engine setup/resolution failure so render error handling can tell
 * it apart from a per-expression render error and rethrow it.
 */
export class EngineSetupError extends Error {
  override name = 'EngineSetupError'
  override cause: unknown

  constructor(cause: unknown) {
    // The cause's own message, so overlays and build logs read the real
    // reason ("Unknown engine …", the install hint) without unwrapping.
    super(String(cause instanceof Error ? cause.message : cause))
    this.cause = cause
  }
}

/**
 * Stand-in renderer for an engine that failed to resolve: the markdown-it
 * rules still register (so a config reload cannot die on the failure), and
 * every expression rethrows it at render time, where VitePress reports it as
 * a dev error overlay or a failed build.
 */
export function failedEngineRenderer(failure: unknown): MathRenderer {
  return {
    name: 'unresolved',
    render: () => {
      throw new EngineSetupError(failure)
    },
  }
}
