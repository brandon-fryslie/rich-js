/**
 * `import.meta.hot` for the programs under examples/ (hot-context.ts). Kept
 * apart from the shape so the docs' own code, which sees Vite's declaration of
 * the same property, can read the shape without this one colliding with it.
 */
interface ImportMeta {
  readonly hot?: import("./hot-context.js").HotContext;
}
