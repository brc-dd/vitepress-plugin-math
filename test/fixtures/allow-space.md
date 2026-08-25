<!--
Test cases adapted (inputs only) from, and credited to:
  - mdit-plugins/plugin-tex, __tests__/tex.spec.ts
    (MIT (c) 2022-present Mr.Hope)
  - microsoft/vscode-markdown-it-katex, test/fixtures/default.txt
    (MIT (c) Microsoft Corporation)

Expected output is THIS plugin's (it deliberately differs from every upstream
listed above -- see DESIGN.md "Parser design"). Math is rendered by the probe
renderer from test/helpers.ts: [I:tex] inline, [D:tex] display block,
[ID:tex] display math inside a paragraph. Wrapper options for every fixture:
vPre: false, copySource: false (attributes have their own tests).

Options: allowInlineWithSpace: true.
-->

tight delimiters still work
.
$a=1$
.
<p><span class="vpm vpm-inline">[I:a=1]</span></p>
.

spaces on both sides
.
$ a = 1 $
.
<p><span class="vpm vpm-inline">[I: a = 1 ]</span></p>
.

space before the closer
.
$a = 1 $
.
<p><span class="vpm vpm-inline">[I:a = 1 ]</span></p>
.

space after the opener
.
$ a = 1$
.
<p><span class="vpm vpm-inline">[I: a = 1]</span></p>
.

spaced math in a sentence
.
A tex equation $ a=1 $ inline.
.
<p>A tex equation <span class="vpm vpm-inline">[I: a=1 ]</span> inline.</p>
.

escaped currency between expressions
.
$a=1$ $b=2$ inline with \$1 hot dogs and $c=3$.
.
<p><span class="vpm vpm-inline">[I:a=1]</span> <span class="vpm vpm-inline">[I:b=2]</span> inline with $1 hot dogs and <span class="vpm vpm-inline">[I:c=3]</span>.</p>
.

consecutive spaced expressions
.
$ a = 1 $ and $ b = 2$
.
<p><span class="vpm vpm-inline">[I: a = 1 ]</span> and <span class="vpm vpm-inline">[I: b = 2]</span></p>
.

two spaced expressions
.
$ a = 1 $ $ b = 2 $
.
<p><span class="vpm vpm-inline">[I: a = 1 ]</span> <span class="vpm vpm-inline">[I: b = 2 ]</span></p>
.

tight then spaced
.
$a=1$ and $ b = 2$
.
<p><span class="vpm vpm-inline">[I:a=1]</span> and <span class="vpm vpm-inline">[I: b = 2]</span></p>
.

a literal dollar now closes early
.
$\text{a $ b}$
.
<p><span class="vpm vpm-inline">[I:\text{a ]</span> b}$</p>
.

empty spaced expression
.
$ $
.
<p><span class="vpm vpm-inline">[I: ]</span></p>
.

currency is still ignored
.
It costs $5.
.
<p>It costs $5.</p>
.

two currency amounts
.
This costs $5 and $10.
.
<p>This costs $5 and $10.</p>
.

spaced block markers
.
$$ a = 1 $$
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D: a = 1]</div>
.

spaced block content
.
$$
 a = 1 
$$
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D: a = 1 ]</div>
.

spaced bracket inline
.
\( a = 1 \)
.
<p><span class="vpm vpm-inline">[I: a = 1 ]</span></p>
.

spaced bracket block
.
\[ a = 1 \]
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D: a = 1]</div>
.

spaced dollars in a link label
.
[link text $ invalid](url)
.
<p><a href="url">link text $ invalid</a></p>
.
