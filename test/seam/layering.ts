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
 * the dependency direction is about. CLAUDE.md reasons the same way when it
 * calls the `color.ts` -> `themes/palette.js` edge safe *because*
 * `palette.ts` only `import type`s back: a type edge is an edge you have to
 * account for, not one you get for free.
 *
 * [LAW:decomposition] Nothing here reads a directory or knows which layer is
 * being checked. It takes parsed files and a `Layer` value and returns
 * findings; the sweep over `src/core/` lives in the test.
 */

import ts from "typescript";
import path from "node:path";
import { REPO_ROOT } from "../coverage/extract.js";
import { moduleSpecifiers, resolveEdge } from "./graph.js";

/**
 * An upward edge the architecture accepts, and the reason it does.
 *
 * [LAW:one-source-of-truth] `why` is a required field rather than a comment
 * beside the entry, so the justification cannot be dropped while the
 * exemption survives — the failure mode of every allowlist that outlives the
 * argument for it. CLAUDE.md's dependency section is the prose rendering of
 * this list; this is the copy a machine re-verifies.
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
        "The internal default theme needs a Palette instance. Safe because " +
        "themes/palette.ts only `import type`s back into core/color.ts, so " +
        "the runtime graph has no cycle. Annotated at the import site.",
    },
    {
      from: "src/core/console.ts",
      to: "src/renderables/rule.ts",
      why:
        "The orchestrator reaching down for Rule, which backs Console.rule() " +
        "and types its options. Annotated at the import site.",
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
  const file = path.relative(REPO_ROOT, sf.fileName);
  const out: OutboundEdge[] = [];
  for (const { literal, erased } of moduleSpecifiers(sf)) {
    const resolved = resolveEdge(literal.text, sf.fileName, options);
    if (resolved === null) continue;
    const target = path.relative(REPO_ROOT, resolved);
    if (isInside(target, layerDir)) continue;
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

/** A failure line naming the import, where it lands, and how it is spelled. */
export function describeOutboundEdge(edge: OutboundEdge): string {
  const kind = edge.erased ? "type-only import of" : "imports";
  return (
    `  ${edge.file}:${edge.line} — ${kind} ${JSON.stringify(edge.specifier)}` +
    ` (${edge.target})`
  );
}

/**
 * Whether a repo-relative path lies inside a repo-relative directory.
 *
 * Compared segment-wise rather than by prefix, so `src/core-utils/x.ts` is
 * not read as living in `src/core` — the string-prefix bug that would make
 * this rule quietly stop reporting a whole sibling directory.
 */
function isInside(target: string, dir: string): boolean {
  const relative = path.relative(dir, target);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
