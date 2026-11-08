/**
 * Sequences a program sends the terminal itself rather than drawing: the
 * window title, the clipboard, a desktop notification. Content can never write
 * a control (`control-codes`), so these are the sanctioned road, and each is
 * written by a named `Console` method that sends nothing when no one is at a
 * terminal. Encoding only: no I/O; which encoding, if any, is `pick`'s.
 */

import type { ColorRgba } from "./color.js";
import { stripOscControls } from "./osc8.js";
import { ESC, ST, utf8, type TerminalFeature } from "./terminal-capabilities.js";

const OSC = `${ESC}]`;

// `text` as base64 of its UTF-8 bytes, which OSC 52 and iTerm2's OSC 1337 carry.
function base64(text: string): string {
  let binary = "";
  for (const byte of utf8(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// Every layer reads these itself: tmux and screen take OSC 2 as the pane's title
// and pass it on as their own settings say, so neither is ever wrapped.
const NATIVE = { tmux: "native", screen: "native", zellij: "native", editor: "native" } as const;

// How clipboard, pointer and notification sequences cross a layer: wrapped for
// tmux's and screen's passthrough, written as is through zellij and an editor.
const WRAPPED = { tmux: "passthrough", screen: "passthrough", zellij: "native", editor: "native" } as const;

// How a sequence that only some outer terminals read crosses a layer. zellij and
// an editor have no passthrough and re-emit only what they understand, which a
// terminal's own protocol is not, so it cannot cross them.
const OUTER_ONLY = { tmux: "passthrough", screen: "passthrough", zellij: "impossible", editor: "impossible" } as const;

/** BEL: the terminal's bell. */
export const BELL: TerminalFeature<void> = {
  name: "bell",
  encodings: [{ name: "BEL", terminals: "any", failure: "ignored", routes: NATIVE, encode: () => "\x07" }],
};

/** OSC 2: the window title. */
export const TITLE: TerminalFeature<string> = {
  name: "title",
  encodings: [{ name: "OSC 2", terminals: "any", failure: "ignored", routes: NATIVE, encode: (title) => `${OSC}2;${stripOscControls(title)}${ST}` }],
};

// A multiplexer keeps a title per pane and has no stack of the outer
// terminal's to push onto, so the push cannot cross one.
const NO_LAYER = { tmux: "impossible", screen: "impossible", zellij: "impossible", editor: "impossible" } as const;

/**
 * XTWINOPS 22/23: the title the terminal showed before a program set its
 * own, saved and given back — xterm's title stack, which kitty, foot and
 * iTerm2 keep. A terminal without one ignores it, and the program's title then
 * stays after it.
 */
export const TITLE_STACK: TerminalFeature<"push" | "pop"> = {
  name: "title stack",
  encodings: [{ name: "XTWINOPS 22/23", terminals: "any", failure: "ignored", routes: NO_LAYER, encode: (op) => `${ESC}[${op === "push" ? 22 : 23};0t` }],
};

/** A color as these sequences carry it, `#rrggbb` with no alpha: two colors that write the same are the same to the terminal. */
export const wireHex = (color: ColorRgba): string => color.hex.slice(0, 7);

/** iTerm2's OSC 6: the tab's color, `undefined` the tab's own. */
export const TAB_COLOR: TerminalFeature<ColorRgba | undefined> = {
  name: "tab color",
  encodings: [
    {
      name: "OSC 6",
      terminals: ["iterm2"],
      failure: "ignored",
      routes: OUTER_ONLY,
      encode: (color) => color === undefined
        ? `${OSC}6;1;bg;*;default${ST}`
        : (["red", "green", "blue"] as const).map((channel) => `${OSC}6;1;bg;${channel};brightness;${color[channel]}${ST}`).join(""),
    },
  ],
};

/**
 * What a tab says of the session in it, as iTerm2 draws it under the tab's
 * title: a dot's color, a line of text and that text's color. A field left out
 * is shown cleared.
 */
export interface SessionStatus {
  readonly indicator?: ColorRgba;
  readonly text?: string;
  readonly color?: ColorRgba;
}

/** iTerm2's OSC 21337, every field written so the status is replaced whole; `undefined` clears it. */
export const SESSION_STATUS: TerminalFeature<SessionStatus | undefined> = {
  name: "session status",
  encodings: [
    {
      name: "OSC 21337",
      terminals: ["iterm2"],
      failure: "ignored",
      routes: OUTER_ONLY,
      encode: (status) => {
        // A `;` would end the field.
        const text = stripOscControls(status?.text ?? "").replaceAll(";", ",");
        const color = (value: ColorRgba | undefined): string => (value === undefined ? "" : wireHex(value));
        return `${OSC}21337;indicator=${color(status?.indicator)};status=${text};status-color=${color(status?.color)}${ST}`;
      },
    },
  ],
};

/**
 * iTerm2's badge, drawn large behind the session's text, as base64 of its
 * UTF-8 bytes; `""` clears it. The text is shown as written: iTerm2 reads a
 * badge as an interpolated string, where `\(…)` evaluates an expression, so
 * every backslash is escaped as `\\`.
 */
export const BADGE: TerminalFeature<string> = {
  name: "badge",
  encodings: [
    {
      name: "OSC 1337 SetBadgeFormat",
      terminals: ["iterm2"],
      failure: "ignored",
      routes: OUTER_ONLY,
      encode: (badge) => `${OSC}1337;SetBadgeFormat=${base64(stripOscControls(badge).replaceAll("\\", "\\\\"))}${ST}`,
    },
  ],
};

// tmux keeps a cursor colour per pane (3.3) and re-emits it; xterm.js reads it in an editor.
const CURSOR_ROUTES = { tmux: "native", screen: "passthrough", zellij: "impossible", editor: "native" } as const;

/** OSC 12: the cursor's color, and OSC 112, the terminal's own back. */
export const CURSOR_COLOR: TerminalFeature<ColorRgba | undefined> = {
  name: "cursor color",
  encodings: [{ name: "OSC 12", terminals: "any", failure: "ignored", routes: CURSOR_ROUTES, encode: (color) => (color === undefined ? `${OSC}112${ST}` : `${OSC}12;${wireHex(color)}${ST}`) }],
};

/**
 * The shapes a pointer takes over a cell, by their CSS `cursor` names, which
 * OSC 22 reads in kitty, foot, Ghostty and WezTerm.
 */
export type PointerShape = (typeof POINTER_SHAPES)[number];

const POINTER_SHAPES = [
  "default", "pointer", "text", "not-allowed", "help", "wait", "crosshair",
  "move", "grab", "grabbing", "ew-resize", "ns-resize",
] as const;

// `value` if it is one of `values`, or a `TypeError` naming it as not `kind`.
function oneOf<T extends string>(kind: string, values: readonly T[], value: unknown): T {
  if ((values as readonly unknown[]).includes(value)) return value as T;
  const named = typeof value === "string" ? JSON.stringify(value) : `a ${typeof value}`;
  throw new TypeError(`${named} is not ${kind}: one of ${values.join(", ")}`);
}

/**
 * `value` as a `PointerShape`, or a `TypeError` naming it. The type binds only
 * a TypeScript caller, and OSC 22 carries the name raw, so a BEL in a cast
 * string would end it and start a sequence of the caller's choosing. Every road
 * a shape takes to the terminal parses it here first, whether or not anything
 * is then written; `POINTER` encodes only what this returns.
 */
export function pointerShape(value: unknown): ParsedPointerShape {
  return oneOf("a pointer shape", POINTER_SHAPES, value) as ParsedPointerShape;
}

declare const parsed: unique symbol;

/** A `PointerShape` that `pointerShape` has checked at runtime. */
export type ParsedPointerShape = PointerShape & { readonly [parsed]: true };

/** OSC 22: the mouse pointer's shape over the terminal, ignored by a terminal without it. */
export const POINTER: TerminalFeature<ParsedPointerShape> = {
  name: "pointer",
  encodings: [{ name: "OSC 22", terminals: "any", failure: "ignored", routes: WRAPPED, encode: (shape) => `${OSC}22;${shape}${ST}` }],
};

/** OSC 52: text put on the system clipboard, as base64 of its UTF-8 bytes. */
export const CLIPBOARD: TerminalFeature<string> = {
  name: "clipboard",
  encodings: [
    {
      name: "OSC 52",
      terminals: "any",
      failure: "ignored",
      routes: WRAPPED,
      encode: (text) => `${OSC}52;c;${base64(text)}${ST}`,
    },
  ],
};

/** How hard a notification asks for the reader's attention. kitty takes it; a terminal that cannot grade it shows the notification as it would have. */
export type NotificationUrgency = "low" | "normal" | "critical";

/** A desktop notification; `id` must differ per notification, or kitty updates the earlier one in place. */
export interface Notification {
  readonly title: string;
  readonly body: string | undefined;
  readonly id: string;
  readonly urgency?: NotificationUrgency;
  /** Buttons the notification offers, by label; a click on one is reported back by its 1-based number. kitty only. */
  readonly buttons?: readonly string[];
  /** Whether a click on the notification or one of its buttons is reported back to the program (kitty's `a=report`). kitty only. */
  readonly reportClicks?: boolean;
}

// U+2028 between kitty's button labels: the separator its protocol names.
const BUTTON_SEPARATOR = " ";

/** What kitty reports back when a notification it was asked to report is clicked: its id, and the 1-based button or `undefined` for the notification itself. */
export interface NotificationClick {
  readonly id: string;
  readonly button: number | undefined;
}

/** Reads a terminal's OSC body as kitty's click report, `99;i=<id>;` or `99;i=<id>;<button>`, and `undefined` for any other OSC. */
export function notificationClick(body: string): NotificationClick | undefined {
  const match = /^99;i=([^;]+);(\d*)$/.exec(body);
  if (match === null) return undefined;
  return { id: match[1]!, button: match[2] === "" ? undefined : Number(match[2]) };
}

// OSC 99's `u=`: 0 low, 1 normal, 2 critical.
const URGENCY_CODE = { low: 0, normal: 1, critical: 2 } as const;
const URGENCY_LEVELS: readonly string[] = Object.keys(URGENCY_CODE);

// `value` stripped of controls as the sequence carries it, or a `TypeError` naming what it is for.
function text(value: unknown, what: string): string {
  if (typeof value !== "string") throw new TypeError(`${what} must be text, not ${typeof value}`);
  return stripOscControls(value);
}

/** A `Notification` that `parseNotification` has checked at runtime. */
export type ParsedNotification = Notification & { readonly [parsed]: true };

/**
 * `value` as a `Notification` the encoders may write: an urgency one of
 * `NotificationUrgency`'s levels, and the title, body and labels stripped of
 * controls, with no label left empty by it — or a `TypeError` naming what is
 * wrong. The type binds only a TypeScript caller, and an encoder runs only for
 * the terminal that reads it, so a bad call is refused here, on every road,
 * whether or not anything is then written.
 */
export function parseNotification(value: Notification): ParsedNotification {
  if (value.urgency !== undefined && !URGENCY_LEVELS.includes(value.urgency)) {
    throw new TypeError(`${JSON.stringify(value.urgency)} is not an urgency: one of ${URGENCY_LEVELS.join(", ")}`);
  }
  return {
    title: text(value.title, "a notification's title"),
    body: value.body === undefined ? undefined : text(value.body, "a notification's body"),
    id: value.id,
    urgency: value.urgency,
    // A label holds no U+2028, the separator, which stripping takes out with the other line separators, so a label of only those is empty here.
    buttons: value.buttons?.map((label, index) => {
      const stripped = text(label, `button ${index + 1}`);
      if (stripped === "") throw new TypeError(`button ${index + 1} has no label: every button needs text`);
      return stripped;
    }),
    reportClicks: value.reportClicks,
  } as ParsedNotification;
}

/**
 * kitty's OSC 99, title then body joined by `id`; OSC 777 for foot and
 * Ghostty; and OSC 9, which kitty, Ghostty, iTerm2 and WezTerm read and any
 * other terminal ignores, carrying one line, so title and body are joined there.
 */
export const NOTIFICATION: TerminalFeature<ParsedNotification> = {
  name: "notification",
  encodings: [
    {
      name: "OSC 99",
      terminals: ["kitty"],
      failure: "ignored",
      routes: OUTER_ONLY,
      encode: (notification) => {
        const { title, body, id, urgency, buttons, reportClicks } = notification;
        // The first chunk carries what kitty reads to start the notification: its urgency and whether clicks come back.
        // `a` is a list whose default is `focus`, so naming `report` alone would drop focus-on-click.
        const first = [`i=${id}`, ...(urgency === undefined ? [] : [`u=${URGENCY_CODE[urgency]}`]), ...(reportClicks === true ? ["a=focus,report"] : [])];
        const pieces: [readonly string[], string][] = [[first, title]];
        if (body !== undefined) pieces.push([[`i=${id}`, "p=body"], body]);
        if (buttons !== undefined && buttons.length > 0) pieces.push([[`i=${id}`, "p=buttons"], buttons.join(BUTTON_SEPARATOR)]);
        // kitty shows the notification once its last chunk arrives: every chunk before it says it is not done.
        return pieces.map(([keys, payload], index) => `${OSC}99;${(index < pieces.length - 1 ? [...keys, "d=0"] : keys).join(":")};${payload}${ST}`).join("");
      },
    },
    {
      name: "OSC 777",
      terminals: ["foot", "ghostty"],
      failure: "ignored",
      routes: OUTER_ONLY,
      encode: (notification) => {
        const { title, body } = notification;
        // A `;` would end 777's title field.
        return `${OSC}777;notify;${title.replaceAll(";", ",")};${body ?? ""}${ST}`;
      },
    },
    {
      name: "OSC 9",
      terminals: "any",
      failure: "ignored",
      routes: WRAPPED,
      encode: (notification) => {
        const { title, body } = notification;
        const line = body === undefined ? title : `${title}: ${body}`;
        // ConEmu's sub-commands (`9;4;` progress, `9;9;` directory) open with a
        // number, then a `;` or nothing, and WezTerm and Windows Terminal read
        // them, so a line that would read as one is kept off that shape.
        return `${OSC}9;${/^\d+(;|$)/.test(line) ? ` ${line}` : line}${ST}`;
      },
    },
  ],
};

/**
 * How a program asks for the reader's attention through the terminal's dock
 * or taskbar: `bounce` until the app is focused, `fireworks` once, and `cancel`
 * stops a bounce already running.
 */
export type Attention = "bounce" | "fireworks" | "cancel" | "focus";

// iTerm2's RequestAttention argument for each request that takes one.
const ATTENTION_ARG = { bounce: "yes", fireworks: "fireworks", cancel: "no" } as const;
const ATTENTIONS: readonly Attention[] = ["bounce", "fireworks", "cancel", "focus"];

/** An `Attention` that `parseAttention` has checked at runtime. */
export type ParsedAttention = Attention & { readonly [parsed]: true };

/**
 * `value` as an `Attention`, or a `TypeError` naming it. A JavaScript caller can
 * pass anything, and an encoder runs only for iTerm2, so the check is here, on
 * every road, as `pointerShape` makes it: `ATTENTION` encodes only what this returns.
 */
export function parseAttention(value: unknown): ParsedAttention {
  return oneOf("an attention request", ATTENTIONS, value) as ParsedAttention;
}

/**
 * iTerm2's OSC 1337 attention requests: the dock icon bounces until the app is
 * focused, fireworks go off at the cursor, a bounce is cancelled, and `focus`
 * brings the window to the front (StealFocus, which takes no argument). A
 * terminal that does not read them ignores them.
 */
export const ATTENTION: TerminalFeature<ParsedAttention> = {
  name: "attention",
  encodings: [
    {
      name: "OSC 1337 attention",
      terminals: ["iterm2"],
      failure: "ignored",
      routes: OUTER_ONLY,
      encode: (value) => {
        // Widened from its brand: a map cannot be indexed by a branded literal.
        const attention: Attention = value;
        return attention === "focus" ? `${OSC}1337;StealFocus${ST}` : `${OSC}1337;RequestAttention=${ATTENTION_ARG[attention]}${ST}`;
      },
    },
  ],
};

/**
 * A point in a command-line prompt's life, in the shell-integration zones
 * OSC 133 names: the prompt (`A`), what the reader types (`B`), the output
 * that follows (`C`), and the end of it with the exit it finished with (`D`).
 * `abort` is the `D` with no exit, which ends a command that never finished:
 * a prompt whose answer never came.
 */
export type SemanticMark = "prompt" | "input" | "output" | "abort" | { readonly done: number };

const MARK_CODE = { prompt: "A", input: "B", output: "C" } as const;
const MARK_NAMES: readonly string[] = ["prompt", "input", "output", "abort"];

/** A `SemanticMark` that `parseMark` has checked at runtime. */
export type ParsedSemanticMark = SemanticMark & { readonly [parsed]: true };

/**
 * `value` as a `SemanticMark`, or a `TypeError` naming it: one of the four
 * names, or `{ done }` with an exit that is a whole number from 0 to 255, the
 * range OSC 133 carries in decimal digits. `SEMANTIC_MARK` encodes only what this returns.
 */
export function parseMark(value: unknown): ParsedSemanticMark {
  if ((MARK_NAMES as readonly unknown[]).includes(value)) return value as ParsedSemanticMark;
  const exit = typeof value === "object" && value !== null && "done" in value ? value.done : undefined;
  if (typeof exit === "number" && Number.isInteger(exit) && exit >= 0 && exit <= 255) return value as ParsedSemanticMark;
  const named = typeof value === "string" ? JSON.stringify(value) : exit !== undefined ? `{ done: ${String(exit)} }` : `a ${typeof value}`;
  throw new TypeError(`${named} is not a prompt mark: one of ${MARK_NAMES.join(", ")}, or { done } with an exit from 0 to 255`);
}

/**
 * OSC 133 zones, which a terminal reads to know where each prompt and its
 * output begin and end, so it can select, fold and jump between them. A
 * terminal that does not read them ignores them. Behind tmux they cross
 * through its passthrough. The byte forms are the FinalTerm sequences iTerm2
 * documents (iterm2.com/finalterm.html), the abort's bare `D` included; no
 * probe has yet confirmed them on the other terminals listed, which the
 * recorded probes (6ch.xy8) are for.
 */
export const SEMANTIC_MARK: TerminalFeature<ParsedSemanticMark> = {
  name: "semantic mark",
  encodings: [
    {
      name: "OSC 133",
      terminals: ["iterm2", "kitty", "wezterm", "foot", "ghostty"],
      failure: "ignored",
      routes: OUTER_ONLY,
      encode: (value) => {
        // Widened from its brand: a map cannot be indexed by a branded literal.
        const mark: SemanticMark = value;
        if (mark === "abort") return `${OSC}133;D${ST}`;
        return typeof mark === "string" ? `${OSC}133;${MARK_CODE[mark]}${ST}` : `${OSC}133;D;${mark.done}${ST}`;
      },
    },
  ],
};

/**
 * Where a task stands, as the terminal's own progress indicator shows it — in
 * the tab, the dock, the taskbar. `none` takes the indicator away.
 */
export type TerminalProgress =
  | { readonly state: "normal" | "error" | "paused"; readonly percent: number }
  | { readonly state: "indeterminate" }
  | { readonly state: "none" };

/**
 * What a renderable on the frame says the terminal should show while it is
 * drawn: its share of the progress — a count against a total, or work of no
 * known size — the pointer's shape, the window's chrome, or the color of the
 * terminal's cursor where the frame shows it. Shares from every declarer on a
 * frame are summed; of every other part, the last declared is shown, each
 * field of the chrome on its own.
 */
export type TerminalDeclaration =
  | { readonly kind: "progress"; readonly share: { readonly completed: number; readonly total: number } | "indeterminate" }
  | { readonly kind: "pointer"; readonly shape: ParsedPointerShape }
  | { readonly kind: "chrome"; readonly chrome: Chrome }
  | { readonly kind: "cursor"; readonly color: ColorRgba };

/**
 * What the window and tab around a program show while it runs: the title, and
 * in iTerm2 the tab's color, the session's status under the tab's title, and
 * a badge behind the text. A field left out is the terminal's own.
 */
export interface Chrome {
  readonly title?: string;
  readonly tabColor?: ColorRgba;
  readonly status?: SessionStatus;
  readonly badge?: string;
}

/** The whole percent OSC 9;4 carries: clamped to 0–100, and 0 for no number at all. */
export function shownPercent(percent: number): number {
  return Number.isNaN(percent) ? 0 : Math.round(Math.min(100, Math.max(0, percent)));
}

const PROGRESS_CODE ={ none: 0, normal: 1, error: 2, indeterminate: 3, paused: 4 } as const;

/**
 * ConEmu's OSC 9;4, which iTerm2 (3.6), Ghostty (1.2) and Windows Terminal
 * read. A terminal that reads only bare OSC 9 takes it for a notification.
 */
export const PROGRESS: TerminalFeature<TerminalProgress> = {
  name: "progress",
  encodings: [
    {
      name: "OSC 9;4",
      terminals: ["iterm2", "ghostty", "windows-terminal"],
      failure: "misread",
      routes: OUTER_ONLY,
      encode: (progress) => {
        const percent = "percent" in progress ? `;${shownPercent(progress.percent)}` : "";
        return `${OSC}9;4;${PROGRESS_CODE[progress.state]}${percent}${ST}`;
      },
    },
  ],
};
