# Edge cases

Things that must **stay literal**:

- Prices, escaped: \$5 and \$10, or 5\$ and 10\$ — two bare `$` around digits
  can pair up into math (`$10, or 5$` here would), so a literal `$` in prose
  is always `\$`
- Escaped: \$not math\$, and `\$` in code
- Space-padded: $ not math $
- Word-adjacent: café$x$ or cost$5
- Unclosed: $$ without a closer
  never swallows the page
- Empty: $$$$ and lone $

Things that must **render**:

- Escaped dollar inside math: $\text{costs \$5 today}$ (a lone `$` mid-expression
  never falsely terminates it either — but a *literal* dollar in TeX is always `\$`)
- CJK adjacency: 价格$p = mv$成立
- Multi-line inline: $a +
  b$
- Math in **bold $x^2$ emphasis** and [in links $\gamma$](/)
- Blockquote:
  > $$
  > \sum_{n=1}^\infty \frac{1}{n^2} = \frac{\pi^2}{6}
  > $$
- Image alt keeps math: ![$E=mc^2$ energy](/logo.svg)
- Labels (enabled in this playground) become anchors —
  [jump to #pythagoras](#pythagoras):
  $$
  a^2 + b^2 = c^2
  $$ (pythagoras)

Error handling — an invalid command renders a placeholder instead of crashing the build:
$\notacommand{x}$
