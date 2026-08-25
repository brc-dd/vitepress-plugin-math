<!--
Test cases adapted (inputs only) from, and credited to:
  - executablebooks/markdown-it-dollarmath, tests/fixtures/basic.md
    (MIT (c) 2021 Chris Sewell; derived from ExecutableBooks/MyST-Parser,
    BSD-3-Clause (c) ExecutableBooks)

Expected output is THIS plugin's (it deliberately differs from every upstream
listed above -- see DESIGN.md "Parser design"). Math is rendered by the probe
renderer from test/helpers.ts: [I:tex] inline, [D:tex] display block,
[ID:tex] display math inside a paragraph. Wrapper options for every fixture:
vPre: false, copySource: false (attributes have their own tests).

Options: labels: true. The probe prints the label as [D#label:tex].
-->

single-line block with a label
.
$$x$$ (eq-1)
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D#eq-1:x]</div>
.

multi-line block with a label
.
$$
a=1
$$ (eq-1)
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D#eq-1:a=1]</div>
.

numeric label
.
$$1+1=2$$ (2)
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D#2:1+1=2]</div>
.

label without a space
.
$$a+b$$(1)
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D#1:a+b]</div>
.

label with whitespace is not a label
.
$$1+1=2$$ (a b)
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:1+1=2]</span> (a b)</p>
.

label containing a dollar is not a label
.
$$x$$ ($a)
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:x]</span> ($a)</p>
.

empty label is not a label
.
$$x$$ ()
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:x]</span> ()</p>
.

labelled block after a plain block
.
$$
a = 1
$$

$$
b = 2
$$ (1)
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a = 1]</div>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D#1:b = 2]</div>
.

labelled block in a blockquote
.
> formula
>
> $$ a+b=c$$ (2)
>
> in blockquote.
.
<blockquote>
<p>formula</p>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D#2: a+b=c]</div>
<p>in blockquote.</p>
</blockquote>
.

labelled block followed by a list
.
$$
a=1 \\
b=2
$$ (abc)

- ab $c=1$ d
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D#abc:a=1 \\
b=2]</div>
<ul>
<li>ab <span class="vpm vpm-inline">[I:c=1]</span> d</li>
</ul>
.

labelled block after a code fence
.
```
code
```
$$a+b$$(1)
.
<pre><code>code
</code></pre>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D#1:a+b]</div>
.

mid-paragraph display math takes no label
.
a $$a=1$$ (1) b
.
<p>a <span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:a=1]</span> (1) b</p>
.

inline math is never labelled
.
$x$ (1)
.
<p><span class="vpm vpm-inline">[I:x]</span> (1)</p>
.

bracket blocks take no labels
.
\[x\] (eq)
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:x]</span> (eq)</p>
.

label with trailing spaces
.
$$x$$ (eq-1)   
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D#eq-1:x]</div>
.

an escaped closing marker cannot carry a label
.
$$
a=1
\$$ (eq)
.
<p>$$
a=1
$$ (eq)</p>
.
