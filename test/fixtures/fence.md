<!--
Test-case inputs adapted from the works below; expected output is not.
Full third-party notices: ACKNOWLEDGEMENTS.md §1.4.

Adapted from:
  - mdit-plugins/plugin-tex, __tests__/tex.spec.ts
    (MIT (C) 2022 - PRESENT by MrHope)
  - microsoft/vscode-markdown-it-katex, test/fixtures/fence.txt
    (MIT (c) Microsoft Corporation; (c) 2018 Takahiro Ethan Ikeuchi
    @iktakahiro; (c) 2016 Waylon Flinn)

Expected output is THIS plugin's (it deliberately differs from every upstream
listed above -- see DESIGN.md "Parser design"). Math is rendered by the probe
renderer from test/helpers.ts: [I:tex] inline, [D:tex] display block,
[ID:tex] display math inside a paragraph. Wrapper options for every fixture:
vPre: false, copySource: false (attributes have their own tests).
-->

math fence
.
```math
a=1
```
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a=1]</div>
.

math fence with line-highlight attrs
.
```math {1}
a=1
```
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a=1]</div>
.

math fence with a padded info string
.
``` math 
a = 1
```
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a = 1]</div>
.

math fence with extra spaces in the info string
.
```  math  
a = 1
```
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a = 1]</div>
.

tilde math fence
.
~~~math
2
~~~
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:2]</div>
.

math fence between paragraphs
.
start

```math
2
```

end
.
<p>start</p>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:2]</div>
<p>end</p>
.

math fence with multiple lines
.
```math
a = 1 \\
b = 2
```
.
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a = 1 \\
b = 2]</div>
.

math fence in a list
.
- ```math
  a=1
  ```
.
<ul>
<li>
<div class="vpm vpm-display" data-display="true" tabindex="0">[D:a=1]</div>
</li>
</ul>
.

non-math fence falls through
.
```js
const a = 1
```
.
<pre><code class="language-js">const a = 1
</code></pre>
.

plain fence falls through
.
```
plain code
```
.
<pre><code>plain code
</code></pre>
.

a fence language starting with math is not math
.
```mathematica
x
```
.
<pre><code class="language-mathematica">x
</code></pre>
.

dollars inside a plain fence are inert
.
```
$$x$$
```
.
<pre><code>$$x$$
</code></pre>
.
