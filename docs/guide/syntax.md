# Syntax

Every delimiter below is on by default. Each example is live: what you see rendered on this
page came from the source shown above it, parsed by this plugin and typeset by KaTeX.

## Inline math

### `$…$`

```md
When $a \ne 0$, the roots of $ax^2 + bx + c = 0$ are $x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$.
```

When $a \ne 0$, the roots of $ax^2 + bx + c = 0$ are $x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$.

Two rules keep prose from turning into math by accident:

- the opening `$` may not be preceded by a letter or digit, and may not be followed by a
  space — `cost$5` and `$ x $` stay text;
- the closing `$` may not be preceded by a space, and may not be followed by a digit —
  `$x$5` stays text.

A `$` with whitespace on **both** sides inside an expression is a literal dollar rather than
a closing delimiter, so `$\text{a $ b}$` reaches the engine whole instead of ending early.
(Most engines then want that inner dollar written as `\$` — the parser keeps it, the engine
decides what it means.) Expressions may also span lines:

```md
$a +
b$
```

$a +
b$

::: tip Space-padded delimiters
`$ x $` is text by default, matching KaTeX and Pandoc. Set
[`allowInlineWithSpace`](/reference/options#allowinlinewithspace) to `true` if your content
needs it.
:::

### `` $`…`$ `` — the GitHub form {#the-github-form}

GitHub's dollar-backtick form is a real code span between dollars, so the TeX inside is
protected from markdown entirely.

```md
Inline: $`\{a\}`$, and no flanking rules apply — cost$`x`$here is still math.
```

Inline: $`\{a\}`$, and no flanking rules apply — cost$`x`$here is still math.

This is the form to reach for when TeX and markdown disagree. Inside it:

- backslash escapes survive verbatim, so `` $`\{a\}`$ `` reaches the engine as `\{a\}`;
- `*`, `_` and other markdown characters stay literal;
- there are no word-boundary restrictions on either side;
- a longer backtick run keeps inner backticks — ``` $``x + `y` ``$ ``` works like any code
  span;
- one space is stripped from each end when both ends have one, exactly as CommonMark
  normalizes code spans.

If nothing closes the run, the position is retried as a plain `$…$`, and an unclosed code
span is left to markdown — `` a $`x$ b `` is math over `` `x ``, as on GitHub.

### `\(…\)`

```md
LaTeX-style brackets work as well: \(e^{i\pi} + 1 = 0\).
```

LaTeX-style brackets work as well: \(e^{i\pi} + 1 = 0\).

An unclosed `\(` is left alone, so markdown's own escape handling still turns it into a
literal `(`.

## Display math

### `$$…$$`

On its own lines, `$$` opens a display block:

```md
$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$
```

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

The block is a `<div>` with horizontal scrolling and `tabindex="0"`, so a wide equation can
be scrolled from the keyboard. A **blank line inside `$$` ends the search for a closer**:
an unclosed `$$` renders as literal text instead of swallowing the rest of the page.

A `$$` block can also interrupt a paragraph — no blank line needed before it.

### `\[…\]`

```md
\[
\nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}
\]
```

\[
\nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}
\]

### Mid-paragraph display math

`$$…$$` and `\[…\]` also work inside a paragraph. The engine still renders in display mode;
only the wrapper changes to something inline-legal, so the sentence keeps flowing around it.

```md
The Gaussian integral $$\int e^{-x^2}dx$$ sits right here in the sentence.
```

The Gaussian integral $$\int e^{-x^2}dx$$ sits right here in the sentence.

The same applies when a `$$` line has trailing text after its closer: rather than swallowing
that text into the TeX, the line stays a paragraph and each `$$…$$` pair inside it renders
as inline display math. Turn this off with
[`inlineDisplay: false`](/reference/options#inlinedisplay).

### Math fences

````md
```math
\begin{aligned}
(a+b)^2 &= a^2 + 2ab + b^2 \\
(a-b)^2 &= a^2 - 2ab + b^2
\end{aligned}
```
````

```math
\begin{aligned}
(a+b)^2 &= a^2 + 2ab + b^2 \\
(a-b)^2 &= a^2 - 2ab + b^2
\end{aligned}
```

The fence's info string is matched on its **first word**, so VitePress-style attributes
(` ```math {1} `) still render as math rather than falling through to the syntax
highlighter. Every other language is handed back to VitePress's own fence renderer
untouched. Turn the fence off with
[`mathFence: false`](/reference/options#mathfence).

## Equation labels

With [`labels: true`](/reference/options#labels), a `$$` block may carry a trailing
`(name)` after its closing delimiter. The name becomes the wrapper's `id`, which makes the
equation deep-linkable.

```md
$$
a^2 + b^2 = c^2
$$ (pythagoras)

Jump to [the Pythagorean theorem](#pythagoras).
```

$$
a^2 + b^2 = c^2
$$ (pythagoras)

Jump to [the Pythagorean theorem](#pythagoras).

Labels are off by default (this site turns them on). They are parser-level anchors, not
engine numbering: `\ref`/`\eqref` and AMS tags are the engine's business — see
[engines](/guide/engines).

## Escaping and currency

A literal dollar in prose is `\$`. That is the only form that is always safe:

```md
It costs \$5 and \$10.
```

It costs \$5 and \$10.

Bare dollars are usually fine on their own, but two of them in one paragraph can pair up
into an expression. `$5 and $10` stays text — the closer is followed by a digit — while
`$10, or 5$` does **not**: its closer is preceded by `5` and followed by a space, which is a
perfectly good closing delimiter, and the sentence turns into math.

::: warning
Write `\$` for every literal dollar sign in prose. Relying on the surrounding characters
works until an edit moves them.
:::

Escapes work inside math too: `$\text{costs \$5 today}$` renders as
$\text{costs \$5 today}$. And a lone `$` mid-expression, spaced on both sides, never
terminates an expression early.

## Math in other places

Math is parsed inside emphasis, links, blockquotes and list items, and it survives into
image alt text as its original delimited source.

```md
- Math in **bold $x^2$ emphasis** and [in links $\gamma$](/guide/syntax)
- ![$E=mc^2$ energy](/logo.svg) keeps the TeX in its alt text
- CJK adjacency needs no spaces: 价格$p = mv$成立
```

- Math in **bold $x^2$ emphasis** and [in links $\gamma$](/guide/syntax)
- CJK adjacency needs no spaces: 价格$p = mv$成立

Accented Latin, Greek and Cyrillic letters bind to a `$` the way ASCII letters do
(`café$x$` is text), while CJK and other space-less scripts do not — those scripts never put
a space before an inline formula.

### Tables

Table cells are split on unescaped `|` before inline parsing ever runs, so a pipe inside
math has to be escaped as `\|`. This is a markdown table rule, not a math one — inline code
spans break on `|` in exactly the same way.

```md
| absolute value    | norm              |
| ----------------- | ----------------- |
| $\lvert x \rvert$ | $\lVert v \rVert$ |
| $a\|b$            | $\binom{n}{k}$    |
```

| absolute value    | norm              |
| ----------------- | ----------------- |
| $\lvert x \rvert$ | $\lVert v \rVert$ |
| $a\|b$            | $\binom{n}{k}$    |

Display math cannot appear in a table cell at all — block-level constructs never can.

## Quick reference

| Input                             | Result                                              |
| --------------------------------- | --------------------------------------------------- |
| `$x+y$`                           | inline math                                          |
| `` $`x+y`$ ``                     | inline math, TeX protected from markdown             |
| `\(x+y\)`                         | inline math                                          |
| `$$ … $$` on its own lines        | display math block                                   |
| `\[ … \]` on its own lines        | display math block                                   |
| `a $$x$$ b`, `a \[x\] b`          | display math rendered inline                         |
| ` ```math ` fence                 | display math block                                   |
| `$$x$$ (label)`                   | display math with an `id` anchor (`labels: true`)    |
| `\$`                              | a literal dollar sign                                |
| `$ x $`                           | text, unless `allowInlineWithSpace` is on            |
| `cost$5`, `$x$5`                  | text — word boundary and currency guards             |

Which of these are parsed at all is controlled by
[`delimiters`](/reference/options#delimiters), [`mathFence`](/reference/options#mathfence)
and [`inlineDisplay`](/reference/options#inlinedisplay). If you are moving content over
from GitHub, read [GitHub compatibility](/guide/github-compatibility) next.
