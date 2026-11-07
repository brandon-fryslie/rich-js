/**
 * What the terminal holds that a frame declares rather than draws — today its
 * progress indicator — and the commit that brings the terminal from what it
 * holds to what the last frame declared. A view is drawn every frame, so a
 * declaration repeats; the commit sends only what changed, and a commit
 * against `NOTHING_COMMITTED` re-sends everything, which is how a terminal
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

type DecidingFeatures = Pick<TerminalFeatures, "capabilities" | "policy" | "layers">;

/**
 * What a commit remembers: what the terminal was actually sent, and the last
 * change refused, with the features that refused it. A refusal writes
 * nothing, so `sent` stays what the terminal holds, and the next commit under
 * other features decides that change again on its own.
 */
export interface Committed {
  readonly sent: TerminalState;
  readonly refused: { readonly wanted: TerminalState; readonly by: DecidingFeatures } | undefined;
}

/** Nothing sent and nothing refused: what a take starts from. */
export const NOTHING_COMMITTED: Committed = { sent: EMPTY_TERMINAL_STATE, refused: undefined };

/**
 * The terminal brought from what it was sent to `wanted`: what is remembered
 * after, and every send decided on the way, those that write nothing
 * included. Each change decided against is decided once per features: the
 * same ones would refuse it on every frame, so the log records it at the
 * change and not sixty times a second. A clear the features refuse — a hand-back
 * under features that no longer allow the indicator — leaves it shown, since
 * sending what they refuse is what they exist to prevent.
 */
export function commitTerminalState(
  committed: Committed,
  wanted: TerminalState,
  features: DecidingFeatures,
): { readonly next: Committed; readonly sends: readonly TerminalSend[] } {
  if (sameProgress(committed.sent.progress, wanted.progress)) return { next: { sent: committed.sent, refused: undefined }, sends: [] };
  const { refused } = committed;
  if (refused !== undefined && refused.by === features && sameProgress(refused.wanted.progress, wanted.progress)) return { next: committed, sends: [] };
  const send = pick(PROGRESS, wanted.progress, features);
  const next = send.bytes === undefined ? { sent: committed.sent, refused: { wanted, by: features } } : { sent: wanted, refused: undefined };
  return { next, sends: [send] };
}
