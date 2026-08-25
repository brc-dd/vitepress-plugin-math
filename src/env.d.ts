// Ambient declarations for consumers' typechecking. Reference from a
// tsconfig via `"types": ["vitepress-plugin-math/env"]` (or a triple-slash
// `/// <reference types="vitepress-plugin-math/env" />`).
//
// Must stay a declaration file: `moduleDetection: "force"` setups treat any
// `.ts` file as a module, where `declare module` becomes an augmentation
// and TS2664s on virtual specifiers.

declare module 'virtual:vitepress-plugin-math.css' {}
