/*
 * Who reaches node's ambient `process`, and for what.
 *
 * The library used to state this fact in prose in four places — a sentence in
 * `docs/widgets.md` telling a reader which host owns the terminal, and module
 * headers in `src/node/` and `src/widgets/` telling the next author where a
 * host read belongs. Each was a claim about which files exist, or which
 * implementations of an interface do, and neither is a set a human keeps true
 * by hand. Three had narrowed themselves to a scope where they still held; the
 * docs one was simply false. None of the four mentioned `src/node/prompt.ts`,
 * which reads `process.stdin` and `process.stdout`.
 *
 * So `HOST_ACCESS` below is the one authoritative copy, and the prose points
 * at it rather than restating it.
 *
 * [LAW:no-shared-mutable-globals] `process` is the shared mutable global this
 * package cannot own but can bound. The bound is per-file *and per-property*:
 * an entry does not say "this file may touch the host", it says which names it
 * takes off it. That granularity is what let the scan settle the question the
 * narrowed sentences were circling — and settle it against them. There is no
 * sole reader of `process.stdin`; there are two, and what is actually true is
 * that both sit behind `package.json#exports` subpaths a consumer has to name.
 * That is asserted in the test, where a scan can contradict it.
 *
 * DELIBERATELY NOT the browser-safety rule next door, though both scan for the
 * same identifier. `browser-safe.ts` asks whether a read happens at *module
 * scope* on a path reachable from the barrel, because that is what throws when
 * a browser evaluates the module; it is right not to care about a read inside
 * a function body. This rule counts every read in every scope, because a
 * capability taken from the host inside a function body is still a capability
 * this package took. Same identifier, two questions, two answers — do not
 * unify them.
 */

import ts from "typescript";
import { repoRelative } from "../coverage/extract.js";
import { isNameSlot } from "./identifiers.js";

/** The global this rule is about. */
const AMBIENT_HOST = "process";

/**
 * What a read takes off the ambient host.
 *
 * [LAW:types-are-the-program] Two variants rather than a member name that is
 * sometimes absent. A named read is bounded by that name; a read of the object
 * itself is bounded by nothing this scan can see, and the entry that permits
 * one has to argue what bounds it instead. Collapsing them into one optional
 * field would let the weaker claim be written where the stronger one is meant.
 */
export type HostSurface =
  | { readonly kind: "member"; readonly name: string }
  | { readonly kind: "object" };

/** One place in `src/` that reads the ambient host. */
export interface AmbientRead {
  readonly file: string;
  readonly line: number;
  readonly surface: HostSurface;
}

/**
 * A file permitted to reach the host, the surface it takes, and why.
 *
 * [LAW:one-source-of-truth] `why` is a required field rather than a comment
 * beside the entry, so the justification cannot be dropped while the
 * permission survives — the failure mode of every allowlist that outlives the
 * argument for it. The same shape, and the same reason, as
 * `SanctionedEdge.why` in `layering.ts`.
 */
export interface HostAccess {
  readonly file: string;
  readonly surface: readonly HostSurface[];
  readonly why: string;
}

const member = (name: string): HostSurface => ({ kind: "member", name });
const WHOLE_OBJECT: HostSurface = { kind: "object" };

/**
 * Every file in `src/` that reaches node's ambient `process`.
 *
 * Read as a whole it is the answer to "who owns node host access", and the
 * answer is not one owner: five files, two of which read `stdin`. Every entry
 * is the *default* of a capability the caller can pass instead — that is the
 * pattern the seam is built on, and the honest claim the sole-owner sentences
 * were reaching for. An entry that cannot say so in its `why` is a seam
 * violation wearing a permission.
 */
export const HOST_ACCESS: readonly HostAccess[] = [
  {
    file: "src/core/color.ts",
    surface: [member("env"), member("stdout")],
    why:
      "Colour detection's ambient default. `detectColorSystem` takes `env` and " +
      "`isTTY` as options; these two reads are what it falls back to when a " +
      "caller passes neither, and both sit behind a `typeof process` guard so " +
      "the module loads in a browser.",
  },
  {
    file: "src/core/console.ts",
    surface: [WHOLE_OBJECT],
    why:
      "`ambientEnvironment()`, the default of Console's injected " +
      "`ConsoleEnvironment`. The object escapes whole because `process` " +
      "satisfies that interface structurally and needs no adapter — so the " +
      "surface is bounded by the interface (`env`, `stdout`, `stderr`) rather " +
      "than by this scan. Console never reads `stdin` and never sets raw mode.",
  },
  {
    file: "src/node/terminal-host.ts",
    surface: [member("stdin"), member("stdout")],
    why:
      "The node `TerminalHost`'s stream defaults, overridable per instance so " +
      "tests drive it over `PassThrough`. `EventRouter` switches raw mode " +
      "through the `TerminalHost` seam, and this is the only implementation " +
      "where that reaches a real TTY — the browser host's is a no-op.",
  },
  {
    file: "src/node/prompt.ts",
    surface: [member("stdin"), member("stdout")],
    why:
      "The readline interface `nodeAsk` opens per call. A `Prompt` takes its " +
      "`PromptInput` as an argument, so this is the node implementation of " +
      "that capability rather than a reach from inside the renderable.",
  },
  {
    file: "src/node/traceback.ts",
    surface: [member("stderr"), member("exit"), member("on"), member("off")],
    why:
      "The crash handler is process-wide by nature: `on`/`off` install it, " +
      "`stderr` and `exit` are how a report gets out before the runtime tears " +
      "down. Installing it is `installTraceback`, an explicit call — rendering " +
      "a `Traceback` touches none of this.",
  },
];

/**
 * Every read of the ambient host in `sf`, in source order.
 *
 * `typeof process` is not a read and is skipped. It is the one expression in
 * the language that can mention an unbound name without throwing, and it takes
 * nothing off the host — it asks whether a host is there. Counting it would
 * put a whole-object entry against every file that guards carefully, which
 * inverts the signal this list exists to carry. Nothing hides behind the
 * skip: whatever the guard protects is itself a read, so
 * `typeof process === "undefined" ? {} : process.env` still reports `env`.
 *
 * Shadowing is deliberately unanswered. A file that binds its own `process`
 * reports anyway and has to say so in an entry. Answering it properly needs
 * scope resolution, and the strict direction costs nothing while nothing in
 * `src/` shadows the name — where a lenient one would silently excuse a real
 * read the day something did.
 */
export function ambientProcessReads(sf: ts.SourceFile): AmbientRead[] {
  const file = repoRelative(sf.fileName);
  const out: AmbientRead[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === AMBIENT_HOST && isHostRead(node)) {
      out.push({
        file,
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        surface: surfaceOf(node),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Reads no entry in the registry covers — the violations. */
export function unregistered(
  reads: readonly AmbientRead[],
  registry: readonly HostAccess[],
): AmbientRead[] {
  return reads.filter((read) => !permits(registry, read.file, read.surface));
}

/**
 * Registered surfaces that no read matches.
 *
 * The arm that keeps the list honest as the code moves under it: a permission
 * for a read somebody deleted is a standing grant nobody asked for, and it
 * reads in a diff exactly like one that is still load-bearing. A file that
 * stopped touching the host altogether falls out here as all of its surfaces
 * at once, which is the same finding and needs no arm of its own.
 */
export function unexercised(
  reads: readonly AmbientRead[],
  registry: readonly HostAccess[],
): { readonly file: string; readonly surface: HostSurface }[] {
  return registry.flatMap((entry) =>
    entry.surface
      .filter((surface) => !reads.some((read) => matches(read, entry.file, surface)))
      .map((surface) => ({ file: entry.file, surface })),
  );
}

/** A failure line naming the file, the line, and what it takes off the host. */
export function describeRead(read: AmbientRead): string {
  return `  ${read.file}:${read.line} — reads ${describeSurface(read.surface)}`;
}

/** How a surface is spelled in source, which is how a failure should name it. */
export function describeSurface(surface: HostSurface): string {
  return surface.kind === "member"
    ? `\`process.${surface.name}\``
    : "`process` itself, whole";
}

function permits(
  registry: readonly HostAccess[],
  file: string,
  surface: HostSurface,
): boolean {
  return registry.some(
    (entry) => entry.file === file && entry.surface.some((s) => sameSurface(s, surface)),
  );
}

function matches(read: AmbientRead, file: string, surface: HostSurface): boolean {
  return read.file === file && sameSurface(read.surface, surface);
}

function sameSurface(a: HostSurface, b: HostSurface): boolean {
  return a.kind === "member" && b.kind === "member" ? a.name === b.name : a.kind === b.kind;
}

/** Whether this occurrence of the name reads the global rather than naming a slot. */
function isHostRead(id: ts.Identifier): boolean {
  const parent = id.parent;
  if (ts.isTypeOfExpression(parent) || ts.isTypeQueryNode(parent)) return false;
  return !isNameSlot(id);
}

/**
 * What is taken off the host at this occurrence.
 *
 * An element access resolves to a member only when its key is a literal;
 * `process[name]` could be any property, so it reports as the whole object and
 * has to be argued for as one.
 */
function surfaceOf(id: ts.Identifier): HostSurface {
  const parent = id.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === id) {
    return member(parent.name.text);
  }
  if (ts.isElementAccessExpression(parent) && parent.expression === id) {
    const key = parent.argumentExpression;
    if (ts.isStringLiteralLike(key)) return member(key.text);
  }
  return WHOLE_OBJECT;
}
