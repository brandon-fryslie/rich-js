/*
 * Following a receiver chain to the class it lands on.
 *
 * Pure — a surface map in, a resolution out. No program is built and no file is
 * read here, so the rules below can be exercised against a synthetic surface.
 * [LAW:effects-at-boundaries] The `.test.ts` beside `symbol-existence` owns
 * building the real surface and sweeping `docs/` with it.
 *
 * That separation is the point, and it was earned. These rules used to close
 * over the module-level `surfaceByName` in the sweep, which meant every branch
 * could only ever be reached with whatever the real `docs/` corpus happened to
 * contain. The corpus has no ambiguous class name and no chain that dead-ends,
 * so the unresolved arms below were never taken: an inverted `> 1`, a broken
 * origin comparison, or a refactor that made `lookupType` always succeed would
 * have kept every assertion in that file green. Three separate fixes have
 * already landed on this logic across one review, which is the evidence that a
 * branch nothing exercises is a branch that regresses.
 *
 * A corpus assertion can only ratify the corpus. `resolve-chain.test.ts` hands
 * these functions the surfaces `docs/` does not contain. [LAW:verifiable-goals]
 */

import type { MemberUse } from "./code-blocks.js";

/** One class or interface on this package's public surface. */
export interface SurfaceType {
  /** Public instance members. */
  readonly members: Set<string>;
  /**
   * Entry module path of each *distinct* class exported under this name, keyed
   * by declaration identity.
   *
   * Counting modules instead would call a re-export ambiguous. This repo
   * re-exports symbols from several entry points on purpose — `extract.ts`
   * cites `ThemeName` from both `./` and `./themes/registry` — so one class
   * reachable two ways must collapse to one origin, or the check fails loudly
   * on correct usage and the obvious fix looks like "stop re-exporting".
   */
  readonly origins: Map<string, string>;
  /** What each member yields, for resolving a receiver chain. */
  readonly yields: Map<string, string>;
}

/** The public surface, keyed by the name a page would write. */
export type Surface = ReadonlyMap<string, SurfaceType>;

/** A resolution, or the reason there is not one. */
export type Resolved<T> = T | { readonly unresolved: string };

/**
 * What one class name means here, or why it means nothing usable.
 *
 * [LAW:single-enforcer] Every step of a chain asks this, including the last.
 * They used to ask differently — the hops checked existence and ambiguity, the
 * terminus checked only ambiguity — so a chain ending in a name this package
 * does not export returned as if resolved, and the ghost check downstream
 * treated the missing class as a pass.
 *
 * A docs page supplies a bare class name and nothing else, so an ambiguous
 * name — two entry points exporting different classes as `Console` — cannot be
 * disambiguated from the input. It is reported rather than silently resolved
 * to whichever module was walked last. [LAW:no-silent-failure]
 */
export function lookupType(surface: Surface, className: string): Resolved<{ info: SurfaceType }> {
  const info = surface.get(className);
  if (!info) return { unresolved: `${className} is not a class this package exports` };
  if (info.origins.size > 1) {
    const paths = [...info.origins.values()].join(" and ");
    return { unresolved: `'${className}' is exported by ${paths}` };
  }
  return { info };
}

/**
 * The class a receiver chain ends at, or why it could not be resolved.
 *
 * [LAW:parse-dont-validate] A resolution carries the `SurfaceType`, so holding one
 * *is* the proof that class exists. Returning the name alone left every caller
 * to look it up again, and the one caller that did treated a failed lookup as
 * nothing to check rather than as a failure.
 */
export function resolveChain(
  surface: Surface,
  use: MemberUse,
): Resolved<{ className: string; info: SurfaceType }> {
  let className = use.rootClass;
  for (const member of use.path) {
    const found = lookupType(surface, className);
    if ("unresolved" in found) return found;
    const next = found.info.yields.get(member);
    if (!next) {
      return { unresolved: `${className}.${member} yields no class to follow` };
    }
    className = next;
  }
  const found = lookupType(surface, className);
  return "unresolved" in found ? found : { className, info: found.info };
}
