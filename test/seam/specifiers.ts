/*
 * What a module specifier names: a file here, a Node builtin, or a package
 * a consumer has to have installed.
 *
 * One purpose, shared by every rule here that reads specifiers rather than
 * following them. `browser-safe.ts` asks whether a surviving edge names a
 * builtin a browser cannot resolve; `optional-peers.ts` asks which packages
 * an entry point obliges a consumer to install. Both must first sort the
 * three kinds apart — the same question, so it lives once.
 *
 * [LAW:effects-at-boundaries] Strings only. Deciding a kind needs the
 * specifier's text and nothing else, so nothing here reads a file or
 * resolves anything; `graph.ts` owns the resolution that follows an edge.
 */

import { builtinModules } from "node:module";

/**
 * [LAW:one-source-of-truth] The builtin list comes from the running Node,
 * not from a list kept here. It already carries the slashed forms
 * (`fs/promises`, `readline/promises`), so membership is one lookup; the
 * `node:` prefix stays a separate arm because specifiers exist under that
 * scheme which the array does not list.
 */
const NODE_BUILTINS = new Set<string>(builtinModules);

/**
 * What a specifier names.
 *
 * [LAW:types-are-the-program] The package name exists on exactly the
 * variant that has one, so a caller asking "which package must be
 * installed" cannot reach for it on a builtin and read `"node:fs"` back.
 * The three kinds are exhaustive over what an ESM specifier can be, which
 * is what lets each rule narrow rather than re-test the text.
 */
export type SpecifierKind =
  | { readonly kind: "relative" }
  | { readonly kind: "builtin" }
  | { readonly kind: "package"; readonly name: string };

/** Which of the three kinds `specifier` is, and the package name if it has one. */
export function classifySpecifier(specifier: string): SpecifierKind {
  if (specifier.startsWith(".")) return { kind: "relative" };
  if (specifier.startsWith("node:") || NODE_BUILTINS.has(specifier)) return { kind: "builtin" };
  return { kind: "package", name: packageNameOf(specifier) };
}

/**
 * The installable package a bare specifier belongs to — `mobx/dist/x` is
 * still `mobx`, and a scoped name keeps both of its segments.
 *
 * A deep import is the shape that makes this necessary: it names a file
 * inside a package, and the thing a consumer installs is the package.
 */
function packageNameOf(specifier: string): string {
  const segments = specifier.split("/");
  return specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0]!;
}
