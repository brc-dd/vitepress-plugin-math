# Changelog

## 0.1.0 (2026-08-27)


### ⚠ BREAKING CHANGES

* zero-config vite plugin API — math() replaces manual wiring

### Features

* **client:** long-press copy chip; suppress iOS Live Text on rendered math ([55d1880](https://github.com/brc-dd/vitepress-plugin-math/commit/55d1880e0044770cc7d2f87a06c77ab82ce9b551))
* fonts pipeline, temml styles, vite font handling, example docs, CI ([cf135e0](https://github.com/brc-dd/vitepress-plugin-math/commit/cf135e079c2afa939640f07a15328a9e6baf14e9))
* labeled display math emits an id anchor; fix edge-cases examples ([5cbd0ed](https://github.com/brc-dd/vitepress-plugin-math/commit/5cbd0ed589fef5563322cf733ba917ec4870f391))
* **mathjax:** live reconfiguration, data-latex stripping, extension fonts ([987e81d](https://github.com/brc-dd/vitepress-plugin-math/commit/987e81d0cde9e33fbe0a2929b01544ebc0d623f1))
* **parser:** GitHub's dollar-backtick inline math ($`x+y`$) ([27bb262](https://github.com/brc-dd/vitepress-plugin-math/commit/27bb262099041612867543cbdbc1938ccb8d5774))
* test suite (366 cases), parser fixes, copy UX, deterministic MathJax SVG ([049e87e](https://github.com/brc-dd/vitepress-plugin-math/commit/049e87effa2586f17fbc82bc8c92d62a589b4d09))
* typed per-engine options via a discriminated engine union ([7dcc26b](https://github.com/brc-dd/vitepress-plugin-math/commit/7dcc26b82673139df71f4f0338e34d93329f4391))
* **vite:** CDN styles and fonts inside webcontainers ([96be52a](https://github.com/brc-dd/vitepress-plugin-math/commit/96be52a3feab054709e69c77591c0c1d6a2ee173))
* zero-config vite plugin API — math() replaces manual wiring ([21cf046](https://github.com/brc-dd/vitepress-plugin-math/commit/21cf046866f109b33cead416773782d965d0f015))


### Bug Fixes

* **build:** copy styles and fonts to dist, not dist/styles/styles ([a6f8ab7](https://github.com/brc-dd/vitepress-plugin-math/commit/a6f8ab701d7bd2c766b17cc26d5bdc4cad0f0cf3))
* **client:** harden copy/selection across browsers, inputs, and print ([fb8c8a8](https://github.com/brc-dd/vitepress-plugin-math/commit/fb8c8a873b7a7678e8a6545d2aca7e99c1d5757a))
* **client:** keep the clipboard fallback from moving the iOS viewport ([7268c8f](https://github.com/brc-dd/vitepress-plugin-math/commit/7268c8fd892fbaf3bb06fb38d5e81fb8b5ca909c))
* **client:** make dblclick formula selection robust over SVG output ([b488f5a](https://github.com/brc-dd/vitepress-plugin-math/commit/b488f5a2de7ce5ac24b25a036251d925ea928383))
* **client:** native selection for selectable engines; Escape dismisses ([af2973a](https://github.com/brc-dd/vitepress-plugin-math/commit/af2973a5ac0436a9969d4cfe1b3eda0bfab948c5))
* **client:** round the selection mark on scrollable math wrappers ([17662be](https://github.com/brc-dd/vitepress-plugin-math/commit/17662bee60fa0703b4c5cfe74505fb19227bca95))
* **client:** route touch double-taps through the copy chip ([b79d524](https://github.com/brc-dd/vitepress-plugin-math/commit/b79d52451296e7b39788ca7acd0adf30032d1079))
* **client:** single keyboard-scrollable container for display math ([084ad3f](https://github.com/brc-dd/vitepress-plugin-math/commit/084ad3f88c733f06995dd471cb759b2dd75a698e))
* **client:** suppress the native select-word gesture over math ([37a3ed6](https://github.com/brc-dd/vitepress-plugin-math/commit/37a3ed6751836925b9300a2eee0c0faf2d469341))
* **env:** declaration-file ambient types + runtime stub for the ./env subpath ([56bc6f6](https://github.com/brc-dd/vitepress-plugin-math/commit/56bc6f625cc07c60eea375241a2db608f71f8e1c))
* give the env types entry a runtime module (attw bundler resolution) ([9ebb274](https://github.com/brc-dd/vitepress-plugin-math/commit/9ebb274fc25e0ca3aa869eb204d9338e058fc6a9))
* **mathjax:** make the mhchem font-extension probe actually find it ([23c83bd](https://github.com/brc-dd/vitepress-plugin-math/commit/23c83bdd6e31f8b84434f26b61d1d00828a153d5))
* restore unplugin-unused devDep (CI); touch long-press + full-height selection mark ([bcd602b](https://github.com/brc-dd/vitepress-plugin-math/commit/bcd602bedb8618c713f61cb368802c01b4df994c))
* surface engine resolution failures at render time, not config time ([0049b55](https://github.com/brc-dd/vitepress-plugin-math/commit/0049b55541d96252c855fec11d3beb16a4e5a8a4))
* **vite:** inject:false keeps the markdown parsing ([eca1a98](https://github.com/brc-dd/vitepress-plugin-math/commit/eca1a9875c9bb7f2de0de9417578e73580e78be4))
* **vite:** survive engine failures at config time; pre-bundle temml refs ([32f3696](https://github.com/brc-dd/vitepress-plugin-math/commit/32f36967773416da2555ea92790f54ca792e8b6c))


### Documentation

* * is the docs site, examples:* the example app; CI builds both. ([caef54f](https://github.com/brc-dd/vitepress-plugin-math/commit/caef54fbd6cfe5de30288e4b7afdb414d167bd2d))
* **comments:** final-state comment pass across code, styles, workflows ([3d5bbfc](https://github.com/brc-dd/vitepress-plugin-math/commit/3d5bbfc92b180026b65c0adfeaabd25cb923be3f))
* **legal:** formal third-party notices, verified provenance ([a5d52f5](https://github.com/brc-dd/vitepress-plugin-math/commit/a5d52f57547bc3cea2ded5e7db82c6c32aa16d1f))
* README around the zero-config API; npm metadata ([18be716](https://github.com/brc-dd/vitepress-plugin-math/commit/18be716b273675956b48bd312131a6ab5606bac0))
* real documentation site under docs/, dogfooding math() ([caef54f](https://github.com/brc-dd/vitepress-plugin-math/commit/caef54fbd6cfe5de30288e4b7afdb414d167bd2d))
