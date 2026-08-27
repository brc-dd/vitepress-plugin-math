import { defineConfig } from 'vitepress'
import { math } from 'vitepress-plugin-math/vite'

const repo = 'https://github.com/brc-dd/vitepress-plugin-math'

/**
 * The live example apps (`examples/docs`, built once per engine) are stitched
 * into the deployed site under `/examples/<engine>/`. They are separate
 * VitePress builds, so the links have to leave the SPA router — hence
 * `target: '_self'`. Nothing serves them in local dev: these links 404 until
 * the deploy workflow assembles both halves.
 */
const examples = ['mathjax', 'katex', 'temml', 'webc'].map((engine) => ({
  text: engine === 'webc' ? '@webc.site/math' : engine,
  link: `/examples/${engine}/`,
  target: '_self',
}))

// No `base` here on purpose: the deploy workflow passes it on the command
// line (`vitepress build docs --base /<repo>/`), so the same config serves a
// root deploy and a project-page deploy.
export default defineConfig({
  title: 'vitepress-plugin-math',
  description: 'Engine-agnostic math for VitePress',
  cleanUrls: true,
  lastUpdated: true,
  // `/examples/<engine>/` is not part of this build (see `examples` above) —
  // the pages exist only in the deployed site, so the link checker cannot
  // resolve them here.
  ignoreDeadLinks: [/^\/examples\//],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Reference', link: '/reference/options', activeMatch: '/reference/' },
      { text: 'Examples', items: examples },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Syntax', link: '/guide/syntax' },
          { text: 'GitHub compatibility', link: '/guide/github-compatibility' },
          { text: 'Engines', link: '/guide/engines' },
          { text: 'Copy and accessibility', link: '/guide/copy-and-a11y' },
          { text: 'Advanced', link: '/guide/advanced' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Options', link: '/reference/options' },
          { text: 'API', link: '/reference/api' },
        ],
      },
      {
        text: 'About',
        items: [
          { text: 'Architecture', link: '/about/architecture' },
          { text: 'Credits', link: '/about/credits' },
        ],
      },
    ],
    outline: 'deep',
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: repo }],
    editLink: {
      pattern: `${repo}/edit/main/docs/:path`,
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Divyansh Singh',
    },
  },
  // This site is its own first user: KaTeX engine, labels on for the anchor
  // examples in the syntax guide, and nothing else wired anywhere.
  vite: { plugins: [math({ engine: 'katex', labels: true })] },
})
