import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'

import 'vitepress-plugin-math/styles/core.css'
// Engine styles — harmless to load together here so VPM_ENGINE switching
// "just works" in this playground; a real site imports only its engine's:
import 'vitepress-plugin-math/styles/katex.css'
import 'vitepress-plugin-math/styles/temml.css'
import 'virtual:vitepress-plugin-math.css'

export default {
  extends: DefaultTheme,
  Layout,
} satisfies Theme
