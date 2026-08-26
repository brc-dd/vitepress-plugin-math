import { defineConfig } from 'vitepress'
import type { MathEngineName } from 'vitepress-plugin-math'
import { withMath } from 'vitepress-plugin-math/vite'

// Switch engines without touching code: VPM_ENGINE=temml pnpm dev
const engine = process.env['VPM_ENGINE'] as MathEngineName | undefined
// MathJax-only: VPM_MATHJAX_OUTPUT=chtml pnpm dev (default: svg)
const mathjaxOutput = process.env['VPM_MATHJAX_OUTPUT'] === 'chtml' ? 'chtml' : undefined

export default withMath(
  defineConfig({
    title: 'vitepress-plugin-math',
    description: 'Engine-agnostic math for VitePress',
    themeConfig: {
      nav: [
        { text: 'Guide', link: '/' },
        { text: 'Gallery', link: '/gallery' },
      ],
      sidebar: [
        { text: 'Basics', link: '/' },
        { text: 'Gallery', link: '/gallery' },
        { text: 'Edge cases', link: '/edge-cases' },
        { text: 'Chemistry & physics', link: '/extensions' },
      ],
    },
  }),
  {
    ...(engine ? { engine } : {}),
    ...(mathjaxOutput ? { mathjax: { output: mathjaxOutput } } : {}),
    labels: true,
  },
)
