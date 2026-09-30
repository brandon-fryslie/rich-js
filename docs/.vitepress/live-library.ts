/**
 * What a live program and its library agree on, in a module both sides can
 * import: the build that bundles the library and rewrites each docs block
 * onto it (example-runner.ts) runs in Node, and the playground, which puts a
 * visitor's code onto it, runs in the page.
 */

/** The name a live program's library is declared under, in the function body both run in. */
export const LIBRARY_BINDING = "__richLibrary";
