---
layout: home

hero:
  name: vitepress-plugin-math
  text: Math that just works
  tagline: Engine-agnostic math for VitePress. One robust TeX parser, four swappable typesetting engines, self-hosted fonts — and no CDN anywhere.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/brc-dd/vitepress-plugin-math

features:
  - title: Its own TeX parser
    details: Written for this plugin, not inherited. Inline display math, bracket delimiters, math fences, equation labels, currency and escapes handled correctly — and an unclosed $$ can never swallow the page.
    link: /guide/syntax
    linkText: Read the syntax guide
  - title: Four engines, all optional
    details: MathJax v4, KaTeX, Temml, or @webc.site/math — optional peer dependencies, dynamically imported. Install one, or pick with a single option. Bring your own renderer if none of them fit.
    link: /guide/engines
    linkText: Compare the engines
  - title: One line of config
    details: A Vite plugin that wires the markdown rules, the engine's stylesheet, its fonts and the client behavior. No markdown.config, no theme file, no stylesheet import.
    link: /guide/getting-started
    linkText: See the setup
  - title: Copy as TeX, and readable math
    details: Selecting a formula and copying gives you back the TeX you wrote, on every engine. Hidden assistive MathML ships in the HTML, and display math is keyboard-scrollable.
    link: /guide/copy-and-a11y
    linkText: How selection works
  - title: Self-hosted fonts, no CDN
    details: Engine stylesheets and webfonts are served from your own deploy, with licenses and provenance tracked in the repo. The one exception is webcontainers, where VitePress asks for CDN fonts itself.
    link: /guide/engines
    linkText: Fonts per engine
  - title: GitHub-compatible syntax
    details: Everything GitHub renders, this renders — including the $`x+y`$ code-span form. Plus the cases GitHub silently drops, like escapes inside math, math in links and footnotes, and mid-paragraph display math.
    link: /guide/github-compatibility
    linkText: See the comparison
---

## Two lines in, math out

```ts
// .vitepress/config.ts
import { defineConfig } from 'vitepress'
import { math } from 'vitepress-plugin-math/vite'

export default defineConfig({
  vite: { plugins: [math({ engine: 'katex' })] },
})
```

That is the whole setup. Write `$e^{i\pi} + 1 = 0$` and you get $e^{i\pi} + 1 = 0$; write a `$$` block and you get

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

Every formula on this site was rendered by this plugin — the site is its own first user. Try selecting the equation above and copying it: the clipboard gets the TeX source back, not the glyphs.

[Get started →](/guide/getting-started)
