# GitHub compatibility

Markdown with math is usually written twice — once for a README or an issue, once for the
docs site. This plugin is built so that the same source works in both places: **everything
GitHub renders as math, this renders as math**, with the same meaning.

The differences all run the same direction. GitHub's math is a post-processing step over
already-parsed markdown, so it drops cases it cannot see; this parser is part of the markdown
pass, so those cases work.

## At a glance

| Source                                        | GitHub                                 | This plugin                    |
| --------------------------------------------- | -------------------------------------- | ------------------------------ |
| `$x+y$`                                       | inline math                            | inline math                    |
| `` $`x+y`$ ``                                 | inline math                            | inline math                    |
| `$$ … $$` on its own lines                    | display math                           | display math                   |
| ` ```math ` fence                             | display math                           | display math                   |
| `$$x$$` mid-paragraph                         | dropped                                | display math, rendered inline  |
| `$\{a\}$`                                     | escapes eaten before math               | escapes reach the engine       |
| `**bold $x$**`, `[link $x$](/)`, footnotes    | skipped                                | rendered                       |
| multi-line `$a +`&nbsp;`b$`                   | not math                               | math                           |
| `\$5 … 5\$`                                   | spurious math between them             | two literal dollar signs       |
| `\(x\)` / `\[x\]`                             | literal text                           | math                           |
| `$$x$$ (label)`                               | literal `(label)`                      | an `id` anchor, opt-in         |

## Escapes survive

GitHub applies markdown's backslash escapes before its math pass, so `$\{a\}$` arrives at
the typesetter as `${a}$` and the braces become grouping instead of literal braces. Here the
math rule owns the span, and the escape is handed to the engine untouched:

```md
$\{a\}$ renders literal braces.
```

$\{a\}$ renders literal braces.

The same asymmetry cuts the other way for currency. On GitHub, escaping the dollars in
`\$5 … 5\$` does not stop its math pass from pairing them up, so a stray formula appears
between them. Here, `\$` is a literal dollar and nothing pairs:

```md
It costs \$5, or maybe 5\$.
```

It costs \$5, or maybe 5\$.

If you need one source that is unambiguous everywhere, use the
[dollar-backtick form](/guide/syntax#the-github-form) — `` $`\{a\}`$ `` means the same thing
in both renderers, because the TeX is inside a code span.

## Display math can interrupt a paragraph

GitHub requires a blank line before a `$$` block. Without one it renders nothing at all —
the math is silently dropped. Here, a `$$` block interrupts a paragraph like any other block
construct, and a `$$…$$` pair that sits *inside* a line becomes display math rendered inline:

```md
Consider the Gaussian integral $$\int e^{-x^2}dx$$ and its value.
```

Consider the Gaussian integral $$\int e^{-x^2}dx$$ and its value.

## Math in emphasis, links and footnotes

GitHub's math pass skips formulas nested inside other inline constructs. All of these render
here:

```md
**bold $x^2$**, [a link with $\gamma$](/guide/syntax), and a footnote[^gauss].

[^gauss]: Carl Friedrich Gauss, who also gave us $\sum_{k=1}^{n} k = \frac{n(n+1)}{2}$.
```

**bold $x^2$**, [a link with $\gamma$](/guide/syntax), and a footnote[^gauss].

[^gauss]: Carl Friedrich Gauss, who also gave us $\sum_{k=1}^{n} k = \frac{n(n+1)}{2}$.

Math also survives into image alt text as its original delimited source, instead of
vanishing from it.

## Multi-line inline math

An inline expression may span a line break:

```md
$a +
b$
```

$a +
b$

## Beyond GitHub

Three things here have no GitHub equivalent at all:

- **`\(…\)` and `\[…\]`** delimiters, for content coming from LaTeX rather than from
  GitHub. Restrict the parser to one family with
  [`delimiters`](/reference/options#delimiters).
- **[Equation labels](/guide/syntax#equation-labels)** — `$$…$$ (name)` becomes an `id`
  anchor you can link to.
- **[Copy as TeX](/guide/copy-and-a11y)** — selecting rendered math and copying gives back
  the source, on every engine.

## What is deliberately the same

The guards that keep prose from becoming math match GitHub's behavior: an opening `$` may
not follow a letter or digit, a closing `$` may not be followed by a digit, and `$ x $` with
spaces on both sides is text. Code spans and fenced code blocks shield `$` from the parser
entirely, so documentation *about* math needs no extra escaping.
