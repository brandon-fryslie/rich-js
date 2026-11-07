/**
 * What the terminal holds that a frame declares rather than draws — its
 * progress indicator, and the pointer's shape over it — and the commit that
 * brings the terminal from what it holds to what is wanted. A view is drawn
 * every frame, so a declaration repeats; the commit sends only what changed,
 * and a commit against `NOTHING_COMMITTED` re-sends everything, which is how a
 * terminal that forgot (a tmux reattach) is brought back. Pure: the painter
 * that owns the terminal writes what it returns.
 */

import { pick, type TerminalFeature, type TerminalFeatures, type TerminalSend } from "./terminal-capabilities.js";
import { POINTER, PROGRESS, pointerShape, shownPercent, type ParsedPointerShape, type TerminalDeclaration, type TerminalProgress } from "./terminal-requests.js";

/** What the terminal is believed to show. */
export interface TerminalState {
  readonly progress: TerminalProgress;
  readonly pointer: ParsedPointerShape;
}

/** A terminal showing nothing a frame declared: what a take starts from and a hand-back returns to. */
export const EMPTY_TERMINAL_STATE: TerminalState = { progress: { state: "none" }, pointer: pointerShape("default") };

/** Every declaration of one frame, folded into the state it asks for: the last pointer declared wins. */
export function declaredState(declarations: readonly TerminalDeclaration[]): TerminalState {
  if (declarations.length === 0) return EMPTY_TERMINAL_STATE;
  let pointer = EMPTY_TERMINAL_STATE.pointer;
  const shares: Extract<TerminalDeclaration, { kind: "progress" }>["share"][] = [];
  for (const declaration of declarations) {
    if (declaration.kind === "pointer") pointer = declaration.shape;
    else shares.push(declaration.share);
  }
  return { progress: progressOf(shares), pointer };
}

function progressOf(shares: readonly Extract<TerminalDeclaration, { kind: "progress" }>["share"][]): TerminalProgress {
  if (shares.length === 0) return EMPTY_TERMINAL_STATE.progress;
  if (shares.includes("indeterminate")) return { state: "indeterminate" };
  const counted = shares.filter((share) => share !== "indeterminate");
  const total = counted.reduce((sum, share) => sum + share.total, 0);
  const completed = counted.reduce((sum, share) => sum + share.completed, 0);
  return total === 0 ? { state: "indeterminate" } : { state: "normal", percent: (completed / total) * 100 };
}

// The same when the terminal would be sent the same: the percent as it is encoded.
const sameProgress = (a: TerminalProgress, b: TerminalProgress): boolean =>
  a.state === b.state && ("percent" in a ? shownPercent(a.percent) : -1) === ("percent" in b ? shownPercent(b.percent) : -1);

type DecidingFeatures = Pick<TerminalFeatures, "capabilities" | "policy" | "layers">;

// [LAW:one-source-of-truth] Each part of the state, the feature that sends it
// and when two values send the same: the one list a commit walks.
const PARTS: { readonly [K in keyof TerminalState]: { readonly feature: TerminalFeature<TerminalState[K]>; same(a: TerminalState[K], b: TerminalState[K]): boolean } } = {
  progress: { feature: PROGRESS, same: sameProgress },
  pointer: { feature: POINTER, same: (a, b) => a === b },
};
const PART_NAMES = ["progress", "pointer"] as const satisfies readonly (keyof TerminalState)[];

/** One part's last refused change, with the features that refused it. */
export interface Refusal<V> {
  readonly wanted: V;
  readonly by: DecidingFeatures;
}

/**
 * What a commit remembers: what the terminal was actually sent, and, for each
 * part, the last change refused. A refusal writes nothing, so `sent` stays
 * what the terminal holds, and the next commit under other features decides
 * that change again on its own.
 */
export interface Committed {
  readonly sent: TerminalState;
  readonly refused: Readonly<Refusals>;
}

type Refusals = { [K in keyof TerminalState]?: Refusal<TerminalState[K]> };

/** Nothing sent and nothing refused: what a take starts from. */
export const NOTHING_COMMITTED: Committed = { sent: EMPTY_TERMINAL_STATE, refused: {} };

/**
 * The terminal brought from what it was sent to `wanted`, part by part — a
 * part `wanted` leaves out is left as it is: what is remembered after, and
 * every send decided on the way, those that write nothing included. A change
 * decided against is decided once per features object the holder hands over:
 * the same object would refuse it on every frame, so the log records it at the
 * change and not sixty times a second. A clear the features refuse — a
 * hand-back under features that no longer allow the indicator — leaves it
 * shown, since sending what they refuse is what they exist to prevent. A
 * commit that changes nothing returns `committed` itself.
 */
export function commitTerminalState(
  committed: Committed,
  wanted: Partial<TerminalState>,
  features: DecidingFeatures,
): { readonly next: Committed; readonly sends: readonly TerminalSend[] } {
  const sent: { -readonly [K in keyof TerminalState]: TerminalState[K] } = { ...committed.sent };
  const refused: Refusals = { ...committed.refused };
  const sends: TerminalSend[] = [];
  let changed = false;
  const decide = <K extends keyof TerminalState>(part: K): void => {
    const value: TerminalState[K] | undefined = wanted[part];
    if (value === undefined) return;
    const { feature, same } = PARTS[part];
    const refusal = committed.refused[part];
    if (same(committed.sent[part], value)) {
      if (refusal !== undefined) {
        delete refused[part];
        changed = true;
      }
      return;
    }
    if (refusal !== undefined && refusal.by === features && same(refusal.wanted, value)) return;
    const send = pick(feature, value, features);
    sends.push(send);
    changed = true;
    if (send.bytes === undefined) {
      const refusal: Refusal<TerminalState[K]> = { wanted: value, by: features };
      (refused as { [P in K]?: Refusal<TerminalState[K]> })[part] = refusal;
    } else {
      sent[part] = value;
      delete refused[part];
    }
  };
  PART_NAMES.forEach(decide);
  return { next: changed ? { sent, refused } : committed, sends };
}
