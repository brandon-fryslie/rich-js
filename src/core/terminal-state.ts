/**
 * What the terminal holds that a frame declares rather than draws — today its
 * progress indicator — and the commit that brings the terminal from what it
 * holds to what the last frame declared. A view is drawn every frame, so a
 * declaration repeats; the commit sends only what changed, and a commit
 * against `EMPTY_TERMINAL_STATE` re-sends everything, which is how a terminal
 * that forgot (a tmux reattach) is brought back. Pure: the painter that owns
 * the terminal writes what it returns.
 */

import { pick, type TerminalFeatures, type TerminalSend } from "./terminal-capabilities.js";
import { PROGRESS, shownPercent, type TerminalDeclaration, type TerminalProgress } from "./terminal-requests.js";

/** What the terminal is believed to show. */
export interface TerminalState {
  readonly progress: TerminalProgress;
}

/** A terminal showing nothing a frame declared: what a take starts from and a hand-back returns to. */
export const EMPTY_TERMINAL_STATE: TerminalState = { progress: { state: "none" } };

/** Every declaration of one frame, folded into the state it asks for. */
export function declaredState(declarations: readonly TerminalDeclaration[]): TerminalState {
  const shares = declarations.map((declaration) => declaration.share);
  if (shares.length === 0) return EMPTY_TERMINAL_STATE;
  if (shares.includes("indeterminate")) return { progress: { state: "indeterminate" } };
  const counted = shares.filter((share) => share !== "indeterminate");
  const total = counted.reduce((sum, share) => sum + share.total, 0);
  const completed = counted.reduce((sum, share) => sum + share.completed, 0);
  return { progress: total === 0 ? { state: "indeterminate" } : { state: "normal", percent: (completed / total) * 100 } };
}

// The same when the terminal would be sent the same: the percent as it is encoded.
const sameProgress = (a: TerminalProgress, b: TerminalProgress): boolean =>
  a.state === b.state && ("percent" in a ? shownPercent(a.percent) : -1) === ("percent" in b ? shownPercent(b.percent) : -1);

/**
 * The terminal brought from `believed` to `wanted`: what it holds after, and
 * every send decided on the way, those that write nothing included. A
 * `believed` of `undefined` is a terminal whose state is unknown — what was
 * decided under features since replaced — so `wanted` is sent whatever it is,
 * a clear included. Each change decided against is decided once: the same
 * capabilities would refuse it on every frame, so the log records it at the change and not sixty times a second.
 */
export function commitTerminalState(
  believed: TerminalState | undefined,
  wanted: TerminalState,
  features: Pick<TerminalFeatures, "capabilities" | "policy" | "layers">,
): { readonly next: TerminalState; readonly sends: readonly TerminalSend[] } {
  if (believed !== undefined && sameProgress(believed.progress, wanted.progress)) return { next: believed, sends: [] };
  return { next: wanted, sends: [pick(PROGRESS, wanted.progress, features)] };
}
