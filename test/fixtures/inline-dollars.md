<!--
Test cases adapted (inputs only) from, and credited to:
  - executablebooks/markdown-it-dollarmath, tests/fixtures/basic.md
    (MIT (c) 2021 Chris Sewell; derived from ExecutableBooks/MyST-Parser,
    BSD-3-Clause (c) ExecutableBooks)
  - microsoft/vscode-markdown-it-katex, test/fixtures/default.txt
    (MIT (c) Microsoft Corporation)
  - mdit-plugins/plugin-tex, __tests__/tex.spec.ts
    (MIT (c) 2022-present Mr.Hope)
  - runarberg/markdown-it-math, test/test.js
    (MIT (c) 2015 Runar Berg Baugsson Sigridarson)

Expected output is THIS plugin's (it deliberately differs from every upstream
listed above -- see DESIGN.md "Parser design"). Math is rendered by the probe
renderer from test/helpers.ts: [I:tex] inline, [D:tex] display block,
[ID:tex] display math inside a paragraph. Wrapper options for every fixture:
vPre: false, copySource: false (attributes have their own tests).
-->

lone dollar
.
$
.
<p>$</p>
.

lone double dollar
.
$$
.
<p>$$</p>
.

single character
.
$a$
.
<p><span class="vpm vpm-inline">[I:a]</span></p>
.

greek character
.
$\varphi$
.
<p><span class="vpm vpm-inline">[I:\varphi]</span></p>
.

starts and ends with numbers
.
$1+1=2$
.
<p><span class="vpm vpm-inline">[I:1+1=2]</span></p>
.

renderer output is inserted verbatim
.
$1+1<3$
.
<p><span class="vpm vpm-inline">[I:1+1<3]</span></p>
.

content with backslashes
.
$a \backslash$
.
<p><span class="vpm vpm-inline">[I:a \backslash]</span></p>
.

digits around the delimiters are currency
.
3$1+2$ $1+2$3
.
<p>3$1+2$ $1+2$3</p>
.

currency after math
.
If you solve $1+2$ you get $3
.
<p>If you solve <span class="vpm vpm-inline">[I:1+2]</span> you get $3</p>
.

inline fraction
.
$\frac{1}{2}$
.
<p><span class="vpm vpm-inline">[I:\frac{1}{2}]</span></p>
.

inline column vector
.
$\begin{pmatrix}x\\y\end{pmatrix}$
.
<p><span class="vpm vpm-inline">[I:\begin{pmatrix}x\\y\end{pmatrix}]</span></p>
.

exponentiation
.
$a^{b}$
.
<p><span class="vpm vpm-inline">[I:a^{b}]</span></p>
.

multi-line inline math
.
a $a
\not=1$ b
.
<p>a <span class="vpm vpm-inline">[I:a
\not=1]</span> b</p>
.

a blank line ends the inline scan
.
a $a

\not=1$ b
.
<p>a $a</p>
<p>\not=1$ b</p>
.

letters before an opener reject it
.
a$1+1=2$
$1+1=2$b
c$x$d
.
<p>a$1+1=2$
<span class="vpm vpm-inline">[I:1+1=2]</span>b
c$x$d</p>
.

trailing dollar after math
.
$x$ $
.
<p><span class="vpm vpm-inline">[I:x]</span> $</p>
.

consecutive expressions
.
$x$ $y$
.
<p><span class="vpm vpm-inline">[I:x]</span> <span class="vpm vpm-inline">[I:y]</span></p>
.

after a hyphenated word
.
so-what is $x$
.
<p>so-what is <span class="vpm vpm-inline">[I:x]</span></p>
.

escaped opening dollar
.
\$1+1=2$
.
<p>$1+1=2$</p>
.

escaped closing dollar
.
$1+1=2\$
.
<p>$1+1=2$</p>
.

escaped start with text
.
\$p_2 = $a
.
<p>$p_2 = $a</p>
.

internal escaped dollar
.
$p_2 = \$1$
.
<p><span class="vpm vpm-inline">[I:p_2 = \$1]</span></p>
.

double-escaped start
.
\\$p_2 = 1$
.
<p>\<span class="vpm vpm-inline">[I:p_2 = 1]</span></p>
.

double-escaped end
.
$p_2 = \\$a
.
<p><span class="vpm vpm-inline">[I:p_2 = \\]</span>a</p>
.

space after opener or before closer
.
$ $
$ x$
$x $
.
<p>$ $
$ x$
$x $</p>
.

after a code span
.
`code`$a-b$
.
<p><code>code</code><span class="vpm vpm-inline">[I:a-b]</span></p>
.

ignores a lone currency amount
.
It costs $5.
.
<p>It costs $5.</p>
.

ignores a spaced dollar
.
a $ b
.
<p>a $ b</p>
.

ignores two adjacent dollars
.
a $$ b
.
<p>a $$ b</p>
.

currency in separate paragraphs
.
This costs $5.

That costs $10.
.
<p>This costs $5.</p>
<p>That costs $10.</p>
.

two currency amounts in one paragraph
.
This costs $5 and $10.
.
<p>This costs $5 and $10.</p>
.

inside a heading
.
# The $N$-eigenvalue problem and two applications
.
<h1>The <span class="vpm vpm-inline">[I:N]</span>-eigenvalue problem and two applications</h1>
.

spaces around inline math are off by default
.
Euler's identity: $ e^{i \pi} + 1 = 0 $
.
<p>Euler's identity: $ e^{i \pi} + 1 = 0 $</p>
.

dollars inside code spans
.
`$x` and `${a}`
.
<p><code>$x</code> and <code>${a}</code></p>
.

empty double dollars mid-paragraph
.
a $$$$ b
.
<p>a $$$$ b</p>
.

escaped double dollar
.
a \$$x$$ b
.
<p>a $$x$$ b</p>
.

equation with surrounding text
.
A tex equation $a=1$ inline.
.
<p>A tex equation <span class="vpm vpm-inline">[I:a=1]</span> inline.</p>
.

three expressions
.
$a=1$ $b=2$ and $c=3$
.
<p><span class="vpm vpm-inline">[I:a=1]</span> <span class="vpm vpm-inline">[I:b=2]</span> and <span class="vpm vpm-inline">[I:c=3]</span></p>
.

punctuation after the closer
.
$x$. $y$, ($z$) $w$!
.
<p><span class="vpm vpm-inline">[I:x]</span>. <span class="vpm vpm-inline">[I:y]</span>, (<span class="vpm vpm-inline">[I:z]</span>) <span class="vpm vpm-inline">[I:w]</span>!</p>
.

literal dollar inside content
.
$\text{a $ b}$
.
<p><span class="vpm vpm-inline">[I:\text{a $ b}]</span></p>
.

literal dollar inside content, trailing text
.
$\text{a $ b} x$
.
<p><span class="vpm vpm-inline">[I:\text{a $ b} x]</span></p>
.

literal dollar between spaces
.
$x = a $ b$
.
<p><span class="vpm vpm-inline">[I:x = a $ b]</span></p>
.

dollar right after the closer
.
$x$$
.
<p><span class="vpm vpm-inline">[I:x]</span>$</p>
.

space before the closer
.
$a = 1 $
.
<p>$a = 1 $</p>
.

a letter after the closer keeps the math
.
$x$a
.
<p><span class="vpm vpm-inline">[I:x]</span>a</p>
.

an underscore after the closer keeps the math
.
$x$_
.
<p><span class="vpm vpm-inline">[I:x]</span>_</p>
.

unclosed marker
.
$a = 1
.
<p>$a = 1</p>
.

escaped opening marker
.
\$a = 1$
.
<p>$a = 1$</p>
.

escaped closing marker
.
$a = 1\$
.
<p>$a = 1$</p>
.

space after the opener
.
$ a = 1$
.
<p>$ a = 1$</p>
.

spaces around content
.
$ a = 1 $
.
<p>$ a = 1 $</p>
.

closer followed by a number
.
$1=$1
.
<p>$1=$1</p>
.

currency context
.
Of course $1 = $1
.
<p>Of course $1 = $1</p>
.

tab after the opener
.
$	test
.
<p>$	test</p>
.

tab before the closer
.
$test	$
.
<p>$test	$</p>
.

number after the closer
.
$test$1
.
<p>$test$1</p>
.

word char before the opener
.
a$x$b
.
<p>a$x$b</p>
.

number before the opener
.
1$x$2
.
<p>1$x$2</p>
.

escaped backslash before the closer
.
$test\\$
.
<p><span class="vpm vpm-inline">[I:test\\]</span></p>
.

escaped backslash then escaped dollar
.
$test\\\$
.
<p>$test\$</p>
.

two escaped backslashes before the closer
.
$test\\\\$
.
<p><span class="vpm vpm-inline">[I:test\\\\]</span></p>
.

no whitespace around the delimiters
.
foo $1+1 = 2$bar
.
<p>foo <span class="vpm vpm-inline">[I:1+1 = 2]</span>bar</p>
.

whitespace before the closer, word after
.
foo $1+1 = 2 $bar
.
<p>foo $1+1 = 2 $bar</p>
.

punctuation may precede the opener
.
foo!$42$bar
.
<p>foo!<span class="vpm vpm-inline">[I:42]</span>bar</p>
.

punctuation may follow the closer
.
The $n$-th order
.
<p>The <span class="vpm vpm-inline">[I:n]</span>-th order</p>
.

paragraph break inside inline math
.
foo $1+1

= 2$ bar
.
<p>foo $1+1</p>
<p>= 2$ bar</p>
.

end of document inside inline math
.
foo $1+1 = 2
.
<p>foo $1+1 = 2</p>
.

markdown syntax inside math is inert
.
foo $1 *i* 1$ bar
.
<p>foo <span class="vpm vpm-inline">[I:1 *i* 1]</span> bar</p>
.

newlines inside inline math are kept
.
foo $1 +
1
= 2$ bar
.
<p>foo <span class="vpm vpm-inline">[I:1 +
1
= 2]</span> bar</p>
.

escaped dollar before math
.
foo \$1$ bar
.
<p>foo $1$ bar</p>
.

digit after the closer aborts
.
$x$5
.
<p>$x$5</p>
.

digit before the opener aborts
.
5$x$
.
<p>5$x$</p>
.

digit adjacency on both sides
.
$x$5 and 5$x$
.
<p>$x$5 and 5$x$</p>
.

first dollar is literal, second expression is math
.
$1 $c$
.
<p>$1 <span class="vpm vpm-inline">[I:c]</span></p>
.

accented word before the opener rejects it
.
café$x$
.
<p>café$x$</p>
.

CJK before the opener opens math
.
价格$x$
.
<p>价格<span class="vpm vpm-inline">[I:x]</span></p>
.

multiline inline math
.
$x +
y$
.
<p><span class="vpm vpm-inline">[I:x +
y]</span></p>
.

math inside a link label
.
[a $b$ c](url)
.
<p><a href="url">a <span class="vpm vpm-inline">[I:b]</span> c</a></p>
.

unclosed math inside a link label
.
[link $incomplete](url
.
<p>[link $incomplete](url</p>
.

spaced dollar inside a link label
.
[link text $ invalid](url)
.
<p><a href="url">link text $ invalid</a></p>
.

closing dollar past the link label
.
[x $a](u) $b$
.
<p><a href="u">x $a</a> <span class="vpm vpm-inline">[I:b]</span></p>
.

currency inside a link label
.
[price $5](page) then $x=1$
.
<p><a href="page">price $5</a> then <span class="vpm vpm-inline">[I:x=1]</span></p>
.

literal dollars inside a link label
.
before [x $a $ ](u) after $z$
.
<p>before <a href="u">x $a $ </a> after <span class="vpm vpm-inline">[I:z]</span></p>
.

complete expression inside a link label
.
[text $a $ b$](u)
.
<p><a href="u">text <span class="vpm vpm-inline">[I:a $ b]</span></a></p>
.

math inside an image alt
.
![$a$ alt](x.png)
.
<p><img src="x.png" alt="$a$ alt"></p>
.

unclosed math inside an image alt
.
![alt $incomplete
.
<p>![alt $incomplete</p>
.

math inside emphasis
.
*a $x$ b*
.
<p><em>a <span class="vpm vpm-inline">[I:x]</span> b</em></p>
.

math in a blockquote
.
> see $a = b + c$
> $c^2=a^2+b^2$
.
<blockquote>
<p>see <span class="vpm vpm-inline">[I:a = b + c]</span>
<span class="vpm vpm-inline">[I:c^2=a^2+b^2]</span></p>
</blockquote>
.

math in a list
.
1. $1+2$
2. $2+3$
    1. $3+4$
.
<ol>
<li><span class="vpm vpm-inline">[I:1+2]</span></li>
<li><span class="vpm vpm-inline">[I:2+3]</span>
<ol>
<li><span class="vpm vpm-inline">[I:3+4]</span></li>
</ol>
</li>
</ol>
.

math in a table cell
.
| a | b |
| - | - |
| $x$ | $y=1$ |
.
<table>
<thead>
<tr>
<th>a</th>
<th>b</th>
</tr>
</thead>
<tbody>
<tr>
<td><span class="vpm vpm-inline">[I:x]</span></td>
<td><span class="vpm vpm-inline">[I:y=1]</span></td>
</tr>
</tbody>
</table>
.

escaped pipe inside math in a table cell
.
| a |
| - |
| $x\|y$ |
.
<table>
<thead>
<tr>
<th>a</th>
</tr>
</thead>
<tbody>
<tr>
<td><span class="vpm vpm-inline">[I:x|y]</span></td>
</tr>
</tbody>
</table>
.
