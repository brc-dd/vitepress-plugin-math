# Copy and accessibility

Rendered math is hostile to the clipboard. Copy a formula out of most documentation sites
and you get a smear of glyphs, or nothing at all. Here, copying a formula gives back the TeX
you wrote — on every engine, including for expressions the engine failed to render.

Try it on this one:

$$
\oint_{\partial \Omega} \omega = \int_{\Omega} d\omega
$$

Selecting it and pressing copy puts `$$\oint_{\partial \Omega} \omega = \int_{\Omega} d\omega$$`
on the clipboard.

## How it works

Every formula is wrapped in an element carrying a `data-tex` attribute with its original
source. That attribute is the copy source, and it is engine-independent: it survives render
errors, output modes with no MathML, and engines that emit no annotations at all.

The client installs one delegated `copy` listener on the document. When a selection contains
math it rewrites the clipboard text — nothing else about selecting or copying changes:

- **partial selections are expanded** to whole formulas, so half an integral still copies as
  the whole integral;
- **inline math** is wrapped in `$…$`, **display math** in `$$…$$` and padded with newlines
  so it keeps its block boundaries;
- **`cut` behaves as `copy`** over a non-editable selection, so it is handled the same way;
- **copies from form fields are never touched** — the site search box, an editable demo, any
  `input`, `textarea` or `contenteditable` keeps its own clipboard behavior;
- a **rich-text flavor** goes on the clipboard too, so pasting into a rich editor keeps the
  prose formatting around the math.

## The selection model

Which gestures apply depends on what the engine put in the DOM.

**Engines that render selectable text** — KaTeX, Temml, MathJax CHTML — keep every native
gesture. Click-drag, double-click, triple-click and find-in-page all behave exactly as they
do over prose. The only difference is what lands on the clipboard.

One fix is applied for KaTeX: its hidden MathML layer is marked unselectable, which it is not
upstream. Without that, a selection copies each formula twice — once from the visual layer,
once from the MathML.

### Assisted selection (MathJax SVG) {#assisted-selection}

MathJax's default SVG output contains no text at all, so the browser has nothing to select.
For those formulas — and only those — the client adds its own layer:

- **double-click** selects the whole formula and highlights it, so a plain copy grabs its
  TeX;
- **double-tap or long-press** on touch marks the formula and offers a "Copy TeX" chip,
  instead of fighting the OS selection UI;
- **Escape** dismisses the mark, as does a tap or click anywhere outside it;
- **Tab then copy** works on display math, which is focusable — no pointer needed.

The highlight is drawn by us because SVG output gets no native selection paint. It uses the
theme's own brand color, and it is hidden when printing.

Formulas rendered as selectable DOM never take this path. Nothing is overridden that the
browser already does well.

## Screen readers

Hidden MathML is what assistive technology actually reads, and it is present in the static
HTML for every engine:

- **MathJax** emits `<mjx-assistive-mml>` — on by default here, though MathJax v4's own
  default is off. Turn it off with
  [`assistiveMml: false`](/guide/engines#mathjax-options).
- **KaTeX** ships a hidden MathML layer alongside its visual HTML.
- **Temml** and **@webc.site/math** emit MathML as their only output, so there is nothing
  hidden about it.

MathJax is the only one of the four whose accessibility does not depend on the browser
exposing MathML to the accessibility tree, which is still uneven across browsers and screen
readers.

## Keyboard

Display math blocks are focusable (`tabindex="0"`) and scroll horizontally, so a wide
equation can be read with the arrow keys after tabbing to it. The focus ring follows the
theme's own focus treatment. Try it on this one:

$$
f(x) = a_0 + a_1 x + a_2 x^2 + a_3 x^3 + a_4 x^4 + a_5 x^5 + a_6 x^6 + a_7 x^7 + a_8 x^8 + a_9 x^9 + a_{10} x^{10} + a_{11} x^{11} + a_{12} x^{12}
$$

Inline math is not focusable — a focus stop per formula in a paragraph would be worse than
the problem it solves.

## Known limitations

These are real and worth knowing about.

**X11 primary selection.** On Linux, selecting text puts it on the PRIMARY selection for
middle-click pasting. No event fires for that, so there is nothing to rewrite — a
middle-click paste yields the rendered glyphs, not TeX. Use an ordinary copy.

**Find-in-page over SVG math.** With MathJax SVG output, the visible formula has no text.
The browser's find can only match the hidden assistive MathML, whose characters are the
Mathematical Alphanumeric codepoints (a math-italic *x* is not the letter `x`), so searching
for a variable name usually will not hit. The other three engines have this problem only for
the same codepoint reason, not for the missing-text one.

**Printing.** The copy chip and the selection highlight are on-screen affordances and are
hidden in print styles.

## Turning it off or tuning it

The Vite plugin starts `useCopyTex()` for you. If you wire the client yourself (see
[manual wiring](/guide/advanced#manual-wiring)) you can pass options:

```ts
useCopyTex({
  selectOnDblclick: false, // leave SVG math to plain browser behavior
  delimiters: { inline: ['\\(', '\\)'], display: ['\\[', '\\]'] },
  blockNewlines: false, // don't pad display math with newlines
  container: () => document.querySelector('.vp-doc'), // only handle math in here
})
```

`selectOnDblclick: false` removes the assisted layer only; the copy rewriting stays. The
full option list is in the [API reference](/reference/api#client).

To drop the copy behavior entirely, set [`inject: false`](/reference/options#inject) and
import the stylesheet yourself.
