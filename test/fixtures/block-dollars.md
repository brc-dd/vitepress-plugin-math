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

single-line block
.
$$1+1=2$$
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:1+1=2]</div>
.

single-line block, greek index
.
$$e_\alpha$$
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:e_\alpha]</div>
.

block with line breaks
.
$$
1+1=2
$$
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:1+1=2]</div>
.

content joins without a trailing newline
.
$$
a=1
$$
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a=1]</div>
.

two blocks
.
$$
a = 1
$$

$$
b = 2
$$
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a = 1]</div>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:b = 2]</div>
.

a blank line inside a block is not math
.
$$
1+1=2

$$
.
<p>$$
1+1=2</p>
<p>$$</p>
.

an unclosed block never swallows the document
.
$$
a = 1
b = 2
.
<p>$$
a = 1
b = 2</p>
.

unclosed block followed by a paragraph
.
$$
a = 1

after
.
<p>$$
a = 1</p>
<p>after</p>
.

multiline matrix
.
$$\begin{matrix}
 f & = & 2 + x + 3 \\
 & = & 5 + x
\end{matrix}$$
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:\begin{matrix}
 f & = & 2 + x + 3 \\
 & = & 5 + x
\end{matrix}]</div>
.

first line carries content
.
$$a=1
b=2
$$
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a=1
b=2]</div>
.

last line carries content
.
$$
a=1
b=2$$
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a=1
b=2]</div>
.

spaces inside the markers
.
$$ 1+1 = 2 $$
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D: 1+1 = 2 ]</div>
.

tab after the closing marker
.
$$a=1$$	
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a=1]</div>
.

ideographic space after the closing marker
.
$$a=1$$　
following
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:a=1]</span>　
following</p>
.

no-break space after the closing marker
.
$$
a=1
$$ 
following
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:
a=1
]</span> 
following</p>
.

block interrupts a paragraph
.
test.
$$a = 1$$
.
<p>test.</p>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a = 1]</div>
.

multi-line block interrupts a paragraph
.
test.
$$
a = 1
$$
.
<p>test.</p>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a = 1]</div>
.

block interrupts a link reference definition
.
[a]: /url
$$
x
$$

[a]
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:x]</div>
<p><a href="/url">a</a></p>
.

a reference definition inside math stays math
.
$$
[a]: /url
$$
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:[a]: /url]</div>
.

block after a code fence
.
```
code
```
$$a+b$$
.
<pre><code>code
</code></pre>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a+b]</div>
.

block in a blockquote
.
> formula
>
> $$ a+b=c$$
>
> in blockquote.
.
<blockquote>
<p>formula</p>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D: a+b=c]</div>
<p>in blockquote.</p>
</blockquote>
.

blockquote block
.
> $$
> x
> $$
.
<blockquote>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:x]</div>
</blockquote>
.

lazy blockquote continuation
.
> $$
> a=1
$$
.
<blockquote>
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:
a=1
]</span></p>
</blockquote>
.

lazy blockquote continuation, unindented content
.
> $$
a=1
$$
.
<blockquote>
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:
a=1
]</span></p>
</blockquote>
.

block in a list item
.
* $1+1 = 2$
* $$
  a+b = c
  $$
.
<ul>
<li><span class="vpm vpm-inline">[I:1+1 = 2]</span></li>
<li>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a+b = c]</div>
</li>
</ul>
.

empty list item then block
.
- 
  $$
  a=1
  $$
.
<ul>
<li>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a=1]</div>
</li>
</ul>
.

negative indent inside a list
.
 - $$
   a=1
 b=2
   $$
.
<ul>
<li><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:
a=1
b=2
]</span></li>
</ul>
.

lazy continuation inside a list item
.
- item
$$
x
$$
.
<ul>
<li>item
<span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:
x
]</span></li>
</ul>
.

loose list item with an unclosed block
.
- test

  $$a = 1

test.
.
<ul>
<li>
<p>test</p>
<p>$$a = 1</p>
</li>
</ul>
<p>test.</p>
.

four spaces makes it a code block
.
    $$
    1+1 = 2
    $$
.
<pre><code>$$
1+1 = 2
$$
</code></pre>
.

a closing marker indented four spaces cannot close
.
$$
1+1 = 2
    $$
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:
1+1 = 2
    ]</span></p>
.

mid-paragraph display math
.
a $$a=1$$ b
.
<p>a <span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:a=1]</span> b</p>
.

display math opening a paragraph
.
$$a=1$$ b
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:a=1]</span> b</p>
.

display math closing a paragraph
.
a $$a=1$$
.
<p>a <span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:a=1]</span></p>
.

trailing math after a single-line block
.
$$a=1$$ and $b=2$
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:a=1]</span> and <span class="vpm vpm-inline">[I:b=2]</span></p>
.

trailing words after a single-line block
.
$$a=1$$ text after
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:a=1]</span> text after</p>
.

trailing punctuation after the closing marker
.
$$
a=1
$$.
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:
a=1
]</span>.</p>
.

no blank line before a single-line block
.
text
$$a=1$$ and $b=2$
.
<p>text
<span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:a=1]</span> and <span class="vpm vpm-inline">[I:b=2]</span></p>
.

unbalanced dollars after a single-line block
.
$$a=1$$ trailing $b=2$$c=3$
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:a=1]</span> trailing <span class="vpm vpm-inline">[I:b=2]</span>$c=3$</p>
.

escaped block markers
.
\$\$a = 1$$
.
<p>$$a = 1$$</p>
.

escaped multiline block markers
.
\$\$
a = 1
\$\$
.
<p>$$
a = 1
$$</p>
.

lone marker pair
.
$$
.
<p>$$</p>
.

marker pair inside a sentence
.
A $$ B
.
<p>A $$ B</p>
.

spaced markers inside a sentence
.
All $$ a = 1 $$ is true.
.
<p>All <span class="vpm vpm-display vpm-display-inline" data-display="true">[ID: a = 1 ]</span> is true.</p>
.

bare LaTeX environment is not math
.
start

\begin{equation}
2
\end{equation}

end
.
<p>start</p>
<p>\begin{equation}
2
\end{equation}</p>
<p>end</p>
.

block ends a table row
.
| a |
| - |
| x |
$$
y=1
$$
.
<table>
<thead>
<tr>
<th>a</th>
</tr>
</thead>
<tbody>
<tr>
<td>x</td>
</tr>
</tbody>
</table>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:y=1]</div>
.

display math inside a table cell
.
| a | b |
| - | - |
| $$x$$ | y |
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
<td><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:x]</span></td>
<td>y</td>
</tr>
</tbody>
</table>
.

display math inside a heading
.
# heading $$x$$ tail
.
<h1>heading <span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:x]</span> tail</h1>
.

display math inside an image alt
.
![$$a$$ alt](x.png)
.
<p><img src="x.png" alt="$$a$$ alt"></p>
.

a label needs the labels option
.
$$x$$ (eq-1)
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:x]</span> (eq-1)</p>
.

a multi-line label needs the labels option
.
$$
a=1
$$ (eq-1)
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:
a=1
]</span> (eq-1)</p>
.
