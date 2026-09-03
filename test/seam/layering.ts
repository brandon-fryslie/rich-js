/*
 * The rule behind CLAUDE.md's claim that `src/core/` has "no upward calls":
 * one scan of one parsed file, answering which of its imports leave the
 * layer, and which of those leaving edges the architecture has sanctioned.
 *
 * ALL module specifiers count here, erased ones included — the deliberate
 * disagreement with `browser-safe.ts` next door, which counts only edges
 * that survive to runtime. Both are right about their own invariant. A
 * browser cannot be broken by an import that emits no bytes; a layer
 * absolutely can be, because `import type { Panel } from "../renderables/"`
 * is `core/` knowing the shape of `renderables/`, and that knowledge is what
 * the dependency direction is about. The `why` on the `color.ts` ->
 * `themes/palette.ts` sanction below reasons the same way: that edge is safe
 * *because* `palette.ts` only `import type`s back, which makes a type edge
 * something you account for, not something you get for free.
 *
 * [LAW:decomposition] Nothing here reads a directory or knows which layer is
 * being checked. It takes parsed files and a `Layer` value and returns
 * findings; the sweep over `src/core/` lives in the test.
 */

import ts from "typescript";
import path from "node:path";
import { REPO_ROOT, isPathInside, repoRelative } from "../coverage/extract.js";
import { moduleSpecifiers, reachableSourceModules, resolveEdge } from "./graph.js";

/**
 * An upward edge the architecture accepts, and the reason it does.
 *
 * [LAW:one-source-of-truth] `why` is a required field rather than a comment
 * beside the entry, so the justification cannot be dropped while the
 * exemption survives — the failure mode of every allowlist that outlives the
 * argument for it. CLAUDE.md names the same two edges and deliberately does
 * not restate their reasons — `why` is the only home for those, so there is
 * no second copy to drift out from under the gate that checks them.
 */
export interface SanctionedEdge {
  readonly from: string;
  readonly to: string;
  readonly why: string;
}

/** A directory whose files may import only from within it, plus its exceptions. */
export interface Layer {
  readonly dir: string;
  readonly sanctioned: readonly SanctionedEdge[];
}

/** One import that resolves outside its layer, sanctioned or not. */
export interface OutboundEdge {
  readonly file: string;
  readonly line: number;
  readonly specifier: string;
  readonly target: string;
  readonly erased: boolean;
}

/**
 * `src/core/` and the two edges CLAUDE.md names as leaving it.
 *
 * A third entry here is not a routine addition. CLAUDE.md says so in the
 * imperative — "a third upward edge is not a fact to append here, it is the
 * signal to stop and reconsider the seam" — and this list is where that
 * sentence becomes checkable.
 */
export const CORE_LAYER: Layer = {
  dir: "src/core",
  sanctioned: [
    {
      from: "src/core/color.ts",
      to: "src/themes/palette.ts",
      why:
        "The internal default theme needs a Palette instance. themes/palette.ts " +
        "only `import type`s back, so nothing it loads at runtime returns to " +
        "core/color.ts. Annotated at the import site.",
    },
    {
      from: "src/core/console.ts",
      to: "src/renderables/rule.ts",
      why:
        "The orchestrator reaching down for Rule, which backs Console.rule() " +
        "and types its options. renderables/rule.ts imports core primitives at " +
        "runtime but never reaches core/console.ts. Annotated at the import site.",
    },
  ],
};

/**
 * Every import in `sf` that resolves to a file outside `layerDir`.
 *
 * Specifiers this repository does not own — `node:*`, packages — resolve to
 * `null` and are not edges out of the layer at all: `core/` depending on
 * `string-width` says nothing about the direction of `src/`.
 */
export function outboundEdges(
  sf: ts.SourceFile,
  layerDir: string,
  options: ts.CompilerOptions,
): OutboundEdge[] {
  const file = repoRelative(sf.fileName);
  const out: OutboundEdge[] = [];
  for (const { literal, erased } of moduleSpecifiers(sf)) {
    const resolved = resolveEdge(literal.text, sf.fileName, options);
    if (resolved === null) continue;
    const target = repoRelative(resolved);
    if (isPathInside(layerDir, target)) continue;
    out.push({
      file,
      line: sf.getLineAndCharacterOfPosition(literal.getStart(sf)).line + 1,
      specifier: literal.text,
      target,
      erased,
    });
  }
  return out;
}

/** The outbound edges the layer has not sanctioned — the violations. */
export function unsanctioned(edges: readonly OutboundEdge[], layer: Layer): OutboundEdge[] {
  return edges.filter(
    (edge) =>
      !layer.sanctioned.some((s) => s.from === edge.file && s.to === edge.target),
  );
}

/**
 * Sanctioned edges that no longer match any import.
 *
 * The arm that keeps the exemption list honest as the code moves under it: a
 * sanction for an import somebody deleted is a standing permission nobody
 * asked for, and it reads in a diff exactly like one that is still load-
 * bearing. Without this, the list only ever grows.
 */
export function unexercised(edges: readonly OutboundEdge[], layer: Layer): SanctionedEdge[] {
  return layer.sanctioned.filter(
    (s) => !edges.some((edge) => s.from === edge.file && s.to === edge.target),
  );
}

/**
 * Sanctioned edges whose target loads its way back to the source at runtime.
 *
 * Every `why` above argues the same safety property in its own words — the
 * edge points up, but it closes no module-level cycle — and this is the arm
 * that holds those words to it. Without it a sanction is a claim about the
 * graph that nothing re-reads, which is the shape of unverified-assertion
 * this whole file exists to retire.
 *
 * The property is deliberately about *module* cycles, not layer ones. The two
 * sanctioned edges are safe for different reasons and only this question
 * covers both: `themes/palette.ts` never returns to `core/` at runtime at
 * all, while `renderables/rule.ts` imports four core primitives and is safe
 * because none of them reaches `core/console.ts`. A reciprocal "the import
 * back must stay type-only" rule would be wrong about the second edge and
 * right about the first only by coincidence.
 *
 * Erasure is asked in both directions, because a cycle needs a runtime edge
 * at every step. Backwards it is `reachableSourceModules`, which walks
 * runtime edges only. Forwards it is the `some` below: a sanction spelled
 * `import type` loads nothing, so the source never pulls the target in and
 * what the target reaches cannot matter. Checking only the return path would
 * report such an edge as cyclic and block a legitimate seam — a false red
 * from the one gate whose whole claim is that its exemptions are verified.
 *
 * A sanction matching no import at all falls out here as not-cyclic, which is
 * right: `unexercised` is the arm that reports it, and reporting it twice
 * would say two things are wrong when one is.
 */
export function cyclicSanctionedEdges(
  edges: readonly OutboundEdge[],
  layer: Layer,
): SanctionedEdge[] {
  return layer.sanctioned.filter(
    (edge) =>
      edges.some((e) => e.file === edge.from && e.target === edge.to && !e.erased) &&
      reachableSourceModules([path.join(REPO_ROOT, edge.to)]).some(
        (module) => repoRelative(module.file) === edge.from,
      ),
  );
}

/** A failure line naming the import, where it lands, and how it is spelled. */
export function describeOutboundEdge(edge: OutboundEdge): string {
  const kind = edge.erased ? "type-only import of" : "imports";
  return (
    `  ${edge.file}:${edge.line} — ${kind} ${JSON.stringify(edge.specifier)}` +
    ` (${edge.target})`
  );
}

