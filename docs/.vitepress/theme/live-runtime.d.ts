/**
 * The live terminal's worker script, served by the docs-examples plugin as
 * `LIVE_RUNTIME_MODULE` (example-runner.ts), which owns what it is.
 */
declare module "virtual:rich-live/runtime" {
  const runtime: string;
  export default runtime;
}
