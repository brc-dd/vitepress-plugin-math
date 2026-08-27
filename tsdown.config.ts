import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.d.ts'],
  platform: 'neutral',
  // One output file per source file, so `./engines/*` in the export map keeps
  // resolving and an unused engine adapter is never pulled in.
  unbundle: true,
  dts: true,
  unused: true,
  publint: true,
  attw: { profile: 'esm-only', level: 'error' },
  // `virtual:` ids are resolved by our own Vite plugin at site build time, and
  // must survive as bare imports.
  deps: { neverBundle: [/^virtual:/, /^node:/] },
  // Assets and the ambient declarations, which `entry` excludes. A directory
  // `from` is copied *into* `to`, so `to` is the parent — `to: 'dist/styles'`
  // would emit `dist/styles/styles/` and break the `./styles/*` and
  // `./fonts/*` subpath exports (and with them the vendored license texts).
  copy: [
    { from: 'src/styles', to: 'dist' },
    { from: 'src/fonts', to: 'dist' },
    { from: 'src/env.d.ts', to: 'dist' },
  ],
})
