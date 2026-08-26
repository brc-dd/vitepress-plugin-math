<!--
Test cases are this plugin's own: GitHub's dollar-backtick form (`$\`…\`$`),
with the semantics verified against GitHub's live renderer.

Math is rendered by the probe renderer from test/helpers.ts: [I:tex] inline,
[D:tex] display block, [ID:tex] display math inside a paragraph. Wrapper
options for every fixture: vPre: false, copySource: false (attributes have
their own tests).
-->

basic form
.
a $`x+y`$ b
.
<p>a <span class="vpm vpm-inline">[I:x+y]</span> b</p>
.

markdown inside the code span stays literal
.
$`a*b*c`$
.
<p><span class="vpm vpm-inline">[I:a*b*c]</span></p>
.

backslashes survive verbatim
.
$`\{a\}`$
.
<p><span class="vpm vpm-inline">[I:\{a\}]</span></p>
.

no flanking restrictions
.
cost$`x`$here
.
<p>cost<span class="vpm vpm-inline">[I:x]</span>here</p>
.

works inside emphasis
.
*em $`x`$ em*
.
<p><em>em <span class="vpm vpm-inline">[I:x]</span> em</em></p>
.

a longer backtick run keeps inner backticks
.
$``x + `y` ``$
.
<p><span class="vpm vpm-inline">[I:x + `y` ]</span></p>
.

one space is stripped from each end
.
$` x+y `$
.
<p><span class="vpm vpm-inline">[I:x+y]</span></p>
.

a space on one end only is kept
.
$`x `$
.
<p><span class="vpm vpm-inline">[I:x ]</span></p>
.

adjacent expressions
.
$`x`$$`y`$
.
<p><span class="vpm vpm-inline">[I:x]</span><span class="vpm vpm-inline">[I:y]</span></p>
.

inside a link label
.
[a $`x`$ b](/u)
.
<p><a href="/u">a <span class="vpm vpm-inline">[I:x]</span> b</a></p>
.

a digit after the closer is not currency
.
$`x`$5
.
<p><span class="vpm vpm-inline">[I:x]</span>5</p>
.

an escaped opener stays literal
.
\$`x`$
.
<p>$<code>x</code>$</p>
.

an unclosed run falls through to `$…$`
.
a $`x$ b
.
<p>a <span class="vpm vpm-inline">[I:`x]</span> b</p>
.

a newline in the content becomes a space
.
$`x +
y`$
.
<p><span class="vpm vpm-inline">[I:x + y]</span></p>
.

a code span without the closing `$` stays a code span
.
a $`x` b
.
<p>a $<code>x</code> b</p>
.

the closer cannot cross a link label
.
[a $`x`](u)$
.
<p><a href="u">a $<code>x</code></a>$</p>
.

no display sibling: `$$` still wins
.
$$`x`$$ mid
.
<p><span class="vpm vpm-display vpm-display-inline" data-display="true">[ID:`x`]</span> mid</p>
.
