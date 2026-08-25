import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.d.ts'],
  platform: 'neutral',
  unbundle: true,
  dts: true,
  unused: true,
  publint: true,
  attw: { profile: 'esm-only', level: 'error' },
  deps: { neverBundle: [/^virtual:/, /^node:/] },
  copy: [
    { from: 'src/styles', to: 'dist/styles' },
    { from: 'src/fonts', to: 'dist/fonts' },
    { from: 'src/env.d.ts', to: 'dist' },
  ],
})
