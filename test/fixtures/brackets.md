<!--
Test-case inputs adapted from the works below; expected output is not.
Full third-party notices: ACKNOWLEDGEMENTS.md §1.4.

Adapted from:
  - mdit-plugins/plugin-tex, __tests__/tex.spec.ts
    (MIT (C) 2022 - PRESENT by MrHope)

Expected output is THIS plugin's (it deliberately differs from every upstream
listed above -- see DESIGN.md "Parser design"). Math is rendered by the probe
renderer from test/helpers.ts: [I:tex] inline, [D:tex] display block,
[ID:tex] display math inside a paragraph. Wrapper options for every fixture:
vPre: false, copySource: false (attributes have their own tests).
-->

inline brackets
.
\(a=1\)
.
<p><span class="vpm vpm-inline">[I:a=1]</span></p>
.

inline brackets in a sentence
.
An equation \(E=mc^2\) inline.
.
<p>An equation <span class="vpm vpm-inline">[I:E=mc^2]</span> inline.</p>
.

three bracket expressions
.
\(x=1\) \(y=2\) and \(z=3\)
.
<p><span class="vpm vpm-inline">[I:x=1]</span> <span class="vpm vpm-inline">[I:y=2]</span> and <span class="vpm vpm-inline">[I:z=3]</span></p>
.

dollars and brackets together
.
Both $x=1$ and \(y=2\) work.
.
<p>Both <span class="vpm vpm-inline">[I:x=1]</span> and <span class="vpm vpm-inline">[I:y=2]</span> work.</p>
.

bracket display block
.
\[a=1\]
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a=1]</div>
.

multi-line bracket block
.
\[
x = \frac{1}{2}
\]
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:x = \frac{1}{2}]</div>
.

bracket block with content on the first line
.
\[x = 1 \\
y = 2
\]
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:x = 1 \\
y = 2]</div>
.

bracket block after a paragraph
.
paragraph
\[
a=1
\]
.
<p>paragraph</p>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a=1]</div>
.

mid-paragraph bracket display
.
a \[x\] b
.
<p>a <span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:x]</span> b</p>
.

bracket display opening a paragraph
.
\[x\] and text
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:x]</span> and text</p>
.

spaces inside bracket markers
.
\[ a = 1 \]
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D: a = 1]</div>
.

unclosed inline bracket
.
\(a = 1
.
<p>(a = 1</p>
.

unclosed bracket block
.
\[a = 1
.
<p>[a = 1</p>
.

escaped opening bracket inline
.
\\(a = 1\)
.
<p>\(a = 1)</p>
.

double-escaped opening bracket inline
.
\\\(a = 1\)
.
<p>\<span class="vpm vpm-inline">[I:a = 1]</span></p>
.

escaped closing bracket inline
.
\(a = 1\\\)
.
<p><span class="vpm vpm-inline">[I:a = 1\\]</span></p>
.

quadruple-escaped opening bracket
.
\\\\(a = 1\)
.
<p>\\(a = 1)</p>
.

many backslashes before the closing bracket
.
\(a = 1\\\\\)
.
<p><span class="vpm vpm-inline">[I:a = 1\\\\]</span></p>
.

escaped opening bracket block
.
\\[a = 1\]
.
<p>\[a = 1]</p>
.

empty inline brackets
.
\(\)
.
<p><span class="vpm vpm-inline">[I:]</span></p>
.

empty bracket block
.
\[\]
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:]</div>
.

bracket math inside a link label
.
[link \(a=1\)](url)
.
<p><a href="url">link <span class="vpm vpm-inline">[I:a=1]</span></a></p>
.

escaped bracket inside a link label
.
[link \\(a=1\)](url)
.
<p><a href="url">link \(a=1)</a></p>
.

bracket math with an escaped closer inside a link label
.
[link \(a=1 \\) \)](url)
.
<p><a href="url">link <span class="vpm vpm-inline">[I:a=1 \\) ]</span></a></p>
.

bracket block in an empty list item
.
- 
  \[
  a=1
  \]
.
<ul>
<li>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a=1]</div>
</li>
</ul>
.

bracket block with negative indent in a list
.
 - \[
   a=1
 b=2
   \]
.
<ul>
<li><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:
a=1
b=2
]</span></li>
</ul>
.

bracket block ending with content
.
\[
a=1
b=2\]
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a=1
b=2]</div>
.

a blank line inside a bracket block
.
\[
a=1

\]
.
<p>[
a=1</p>
<p>]</p>
.

bracket block with trailing text
.
\[a=1\] tail
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:a=1]</span> tail</p>
.

dollar and bracket blocks mixed
.
$$
a = 1
$$

\[
b = 2
\]
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a = 1]</div>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:b = 2]</div>
.

lone backslash
.
\
.
<p>\</p>
.

bracket math inside an image alt
.
![\(a\) alt](x.png)
.
<p><img src="x.png" alt="\(a\) alt"></p>
.

multiline inline brackets
.
\(x +
y\)
.
<p><span class="vpm vpm-inline">[I:x +
y]</span></p>
.
