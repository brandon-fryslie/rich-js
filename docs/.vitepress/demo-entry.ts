/**
 * The file a demo directory under `examples/` runs from, in its card
 * (demo-card.ts), and under its `npm run` script unless a `node.ts` beside it
 * runs the same program with what a page cannot do. A module of its own so
 * the demo bundler's config (vite.config.demos.ts) reads it without loading
 * the docs' example pipeline that builds the card.
 */
export const DEMO_ENTRY = "main.ts";
