/**
 * The live terminal's worker script, served by the docs-examples plugin as
 * `LIVE_RUNTIME_MODULE` (example-runner.ts), which owns what it is.
 */
declare module "virtual:rich-live/runtime" {
  const runtime: string;
  export default runtime;
}

/**
 * What the playground page runs: served by the docs-examples plugin as
 * `PLAYGROUND_MODULE` (example-runner.ts), which owns what each is.
 */
declare module "virtual:rich-live/playground" {
  export const library: string;
  export const start: string;
}

/**
 * The landing page's showcase, a live program: served by the docs-examples
 * plugin as `SHOWCASE_MODULE` (example-runner.ts), which owns what it is.
 */
declare module "virtual:rich-live/showcase" {
  const program: string;
  export default program;
}
