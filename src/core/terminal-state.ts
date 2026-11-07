/**
 * What the terminal holds that a frame declares rather than draws — its
 * progress indicator, the pointer's shape over it, the window's chrome and the
 * cursor's color — and the commit that brings the terminal from what it holds
 * to what is wanted. A view is drawn every frame, so a declaration repeats; the
 * commit sends only what changed, and a commit against `NOTHING_COMMITTED`
 * re-sends everything. Pure: the painter that owns the terminal writes what it
 * returns.
 */

import type { ColorRgba } from "./color.js";
import { pick, type TerminalFeature, type TerminalFeatures, type TerminalSend } from "./terminal-capabilities.js";
import {
  BADGE, CURSOR_COLOR, POINTER, PROGRESS, SESSION_STATUS, TAB_COLOR, TITLE, TITLE_STACK, pointerShape, shownPercent, wireHex,
  type Chrome, type ParsedPointerShape, type SessionStatus, type TerminalDeclaration, type TerminalProgress,
} from "./terminal-requests.js";

/** What the terminal is believed to show; `undefined` is the terminal's own. */
export interface TerminalState {
  readonly progress: TerminalProgress;
  readonly pointer: ParsedPointerShape;
  /**
   * Whether the title the terminal showed is saved on its title stack. Its own
   * part, so a pop is sent only for a push that reached the terminal, whatever
   * the features were when the title was set.
   */
  readonly titleSaved: boolean;
  readonly title: string | undefined;
  readonly tabColor: ColorRgba | undefined;
  readonly status: SessionStatus | undefined;
  readonly badge: string | undefined;
  readonly cursorColor: ColorRgba | undefined;
}

/** A terminal showing nothing a frame declared: what a take starts from and a hand-back returns to. */
export const EMPTY_TERMINAL_STATE: TerminalState = {
  progress: { state: "none" },
  pointer: pointerShape("default"),
  titleSaved: false,
  title: undefined,
  tabColor: undefined,
  status: undefined,
  badge: undefined,
  cursorColor: undefined,
};

/** The parts of the terminal's state a `Chrome` asks for, a field left out the terminal's own. */
export function chromeState({ title, tabColor, status, badge }: Chrome): Pick<TerminalState, "titleSaved" | "title" | "tabColor" | "status" | "badge"> {
  return { titleSaved: title !== undefined, title, tabColor, status, badge };
}

/** Every declaration of one frame, folded into the state it asks for: of every part but progress, the last declared wins. */
export function declaredState(declarations: readonly TerminalDeclaration[]): TerminalState {
  if (declarations.length === 0) return EMPTY_TERMINAL_STATE;
  const state: { -readonly [K in keyof TerminalState]: TerminalState[K] } = { ...EMPTY_TERMINAL_STATE };
  const chrome: { -readonly [K in keyof Chrome]: Chrome[K] } = {};
  const shares: Extract<TerminalDeclaration, { kind: "progress" }>["share"][] = [];
  for (const declaration of declarations) {
    switch (declaration.kind) {
      case "progress":
        shares.push(declaration.share);
        break;
      case "pointer":
        state.pointer = declaration.shape;
        break;
      case "cursor":
        state.cursorColor = declaration.color;
        break;
      case "chrome": {
        const { title, tabColor, status, badge } = declaration.chrome;
        if (title !== undefined) chrome.title = title;
        if (tabColor !== undefined) chrome.tabColor = tabColor;
        if (status !== undefined) chrome.status = status;
        if (badge !== undefined) chrome.badge = badge;
        break;
      }
    }
  }
  return { ...state, ...chromeState(chrome), progress: progressOf(shares) };
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

const sameColor = (a: ColorRgba | undefined, b: ColorRgba | undefined): boolean =>
  (a === undefined ? undefined : wireHex(a)) === (b === undefined ? undefined : wireHex(b));
const sameStatus = (a: SessionStatus | undefined, b: SessionStatus | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && a.text === b.text && sameColor(a.indicator, b.indicator) && sameColor(a.color, b.color));

type DecidingFeatures = Pick<TerminalFeatures, "capabilities" | "policy" | "layers">;

interface Part<V> {
  /** The sends that bring the terminal from `from` to `to`; the last decides whether it got there, and none means nothing need be sent. */
  sends(from: V, to: V, features: DecidingFeatures): readonly TerminalSend[];
  same(a: V, b: V): boolean;
}

// A part one feature sends whole, whatever it held before.
const whole = <V>(feature: TerminalFeature<V>, same: (a: V, b: V) => boolean): Part<V> => ({
  sends: (_from, to, features) => [pick(feature, to, features)],
  same,
});

// The title the terminal showed is pushed before a program's goes over it, and
// popping it gives that one back: the title is taken away by the pop, so taking
// it away sends nothing of its own.
const TITLE_SAVED_PART: Part<boolean> = {
  sends: (_from, to, features) => [pick(TITLE_STACK, to ? "push" : "pop", features)],
  same: (a, b) => a === b,
};

const TITLE_PART: Part<string | undefined> = {
  sends: (_from, to, features) => (to === undefined ? [] : [pick(TITLE, to, features)]),
  same: (a, b) => a === b,
};

const BADGE_PART: Part<string | undefined> = {
  sends: (_from, to, features) => [pick(BADGE, to ?? "", features)],
  same: (a, b) => (a ?? "") === (b ?? ""),
};

// [LAW:one-source-of-truth] Each part of the state, what sends it and when two
// values send the same: the one list a commit walks.
const PARTS: { readonly [K in keyof TerminalState]: Part<TerminalState[K]> } = {
  progress: whole(PROGRESS, sameProgress),
  pointer: whole(POINTER, (a, b) => a === b),
  titleSaved: TITLE_SAVED_PART,
  title: TITLE_PART,
  tabColor: whole(TAB_COLOR, sameColor),
  status: whole(SESSION_STATUS, sameStatus),
  badge: BADGE_PART,
  cursorColor: whole(CURSOR_COLOR, sameColor),
};
const PART_NAMES = Object.keys(EMPTY_TERMINAL_STATE) as readonly (keyof TerminalState)[];

/** One part's last refused change, with the features that refused it. */
export interface Refusal<V> {
  readonly wanted: V;
  readonly by: DecidingFeatures;
}

/**
 * What a commit remembers: what the terminal was actually sent; for each
 * part, the last change refused; and the parts whose bytes crossed a layer
 * inside its passthrough envelope. A refusal writes nothing, so `sent` stays
 * what the terminal holds, and the next commit under other features decides
 * that change again on its own.
 */
export interface Committed {
  readonly sent: TerminalState;
  readonly refused: Readonly<Refusals>;
  readonly wrapped: ReadonlySet<keyof TerminalState>;
}

type Refusals = { [K in keyof TerminalState]?: Refusal<TerminalState[K]> };

/** Nothing sent and nothing refused: what a take starts from. */
export const NOTHING_COMMITTED: Committed = { sent: EMPTY_TERMINAL_STATE, refused: {}, wrapped: new Set() };

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
export function commitTerminalState<P extends keyof TerminalState>(
  committed: Committed,
  // A `Pick`, not a `Partial`: a part named is a value of its own type, so
  // `undefined` reaches only the parts whose type holds it.
  wanted: Pick<TerminalState, P>,
  features: DecidingFeatures,
): { readonly next: Committed; readonly sends: readonly TerminalSend[] } {
  return commit(committed, wanted, features);
}

// Every part `named` holds is a value of its own type: `commitTerminalState`'s
// `Pick` and `resendWrapped`'s copy of what was sent both guarantee it.
function commit(committed: Committed, named: Partial<TerminalState>, features: DecidingFeatures): { readonly next: Committed; readonly sends: readonly TerminalSend[] } {
  const sent: { -readonly [K in keyof TerminalState]: TerminalState[K] } = { ...committed.sent };
  const refused: Refusals = { ...committed.refused };
  const wrapped = new Set(committed.wrapped);
  const sends: TerminalSend[] = [];
  let changed = false;
  const decide = <K extends keyof TerminalState>(part: K): void => {
    if (!(part in named)) return;
    const value = named[part];
    const { sends: sendsOf, same } = PARTS[part];
    const refusal = committed.refused[part];
    if (same(committed.sent[part], value as TerminalState[K])) {
      if (refusal !== undefined) {
        delete refused[part];
        changed = true;
      }
      return;
    }
    if (refusal !== undefined && refusal.by === features && same(refusal.wanted, value as TerminalState[K])) return;
    const decided = sendsOf(committed.sent[part], value as TerminalState[K], features);
    sends.push(...decided);
    changed = true;
    const last = decided.at(-1);
    if (last !== undefined && last.bytes === undefined) {
      const refusal: Refusal<TerminalState[K]> = { wanted: value as TerminalState[K], by: features };
      (refused as { [Q in K]?: Refusal<TerminalState[K]> })[part] = refusal;
    } else {
      sent[part] = value as TerminalState[K];
      delete refused[part];
      if (last?.wrapped === true) wrapped.add(part);
      else wrapped.delete(part);
    }
  };
  PART_NAMES.forEach(decide);
  return { next: changed ? { sent, refused, wrapped } : committed, sends };
}

/**
 * Every part that reached the terminal only inside a passthrough envelope,
 * sent again as if the terminal showed none of it: what a tmux reattach
 * forgets, and only that — a layer that took a part natively re-emits it
 * itself, and a part never wrapped (the title stack) is never sent twice.
 */
export function resendWrapped(committed: Committed, features: DecidingFeatures): { readonly next: Committed; readonly sends: readonly TerminalSend[] } {
  if (committed.wrapped.size === 0) return { next: committed, sends: [] };
  const forgotten: { -readonly [K in keyof TerminalState]: TerminalState[K] } = { ...committed.sent };
  const wanted: { -readonly [K in keyof TerminalState]?: TerminalState[K] } = {};
  const forget = <K extends keyof TerminalState>(part: K): void => {
    forgotten[part] = EMPTY_TERMINAL_STATE[part];
    wanted[part] = committed.sent[part];
  };
  committed.wrapped.forEach(forget);
  return commit({ ...committed, sent: forgotten }, wanted, features);
}
