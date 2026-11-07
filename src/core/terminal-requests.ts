/**
 * Sequences a program sends the terminal itself rather than drawing: the
 * window title, the clipboard, a desktop notification. Content can never write
 * a control (`control-codes`), so these are the sanctioned road, and each is
 * written by a named `Console` method that sends nothing when no one is at a
 * terminal. Encoding only: no I/O; which encoding, if any, is `pick`'s.
 */

import { stripOscControls } from "./osc8.js";
import { ESC, ST, utf8, type TerminalFeature } from "./terminal-capabilities.js";

const OSC = `${ESC}]`;

// Every layer reads these itself: tmux and screen take OSC 2 as the pane's title
// and pass it on as their own settings say, so neither is ever wrapped.
const NATIVE = { tmux: "native", screen: "native", zellij: "native", editor: "native" } as const;

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

/**
 * The shapes a pointer takes over a cell, by their CSS `cursor` names, which
 * OSC 22 reads in kitty, foot, Ghostty and WezTerm.
 */
export type PointerShape = (typeof POINTER_SHAPES)[number];

const POINTER_SHAPES = [
  "default", "pointer", "text", "not-allowed", "help", "wait", "crosshair",
  "move", "grab", "grabbing", "ew-resize", "ns-resize",
] as const;

/**
 * `value` as a `PointerShape`, or a `TypeError` naming it. The type binds only
 * a TypeScript caller, and OSC 22 carries the name raw, so a BEL in a cast
 * string would end it and start a sequence of the caller's choosing. Every road
 * a shape takes to the terminal parses it here first, whether or not anything
 * is then written; `POINTER` encodes only what this returns.
 */
export function pointerShape(value: unknown): ParsedPointerShape {
  if ((POINTER_SHAPES as readonly unknown[]).includes(value)) return value as ParsedPointerShape;
  const named = typeof value === "string" ? JSON.stringify(value) : `a ${typeof value}`;
  throw new TypeError(`${named} is not a pointer shape: one of ${POINTER_SHAPES.join(", ")}`);
}

declare const parsed: unique symbol;

/** A `PointerShape` that `pointerShape` has checked at runtime. */
export type ParsedPointerShape = PointerShape & { readonly [parsed]: true };

// How clipboard, pointer and notification sequences cross a layer: wrapped for
// tmux's and screen's passthrough, written as is through zellij and an editor.
const WRAPPED = { tmux: "passthrough", screen: "passthrough", zellij: "native", editor: "native" } as const;

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
      encode: (text) => {
        let binary = "";
        for (const byte of utf8(text)) binary += String.fromCharCode(byte);
        return `${OSC}52;c;${btoa(binary)}${ST}`;
      },
    },
  ],
};

/** A desktop notification; `id` must differ per notification, or kitty updates the earlier one in place. */
export interface Notification {
  readonly title: string;
  readonly body: string | undefined;
  readonly id: string;
}

const shown = ({ title, body, id }: Notification): Notification => ({ title: stripOscControls(title), body: body === undefined ? undefined : stripOscControls(body), id });

/**
 * kitty's OSC 99, title then body joined by `id`; OSC 777 for foot and
 * Ghostty; and OSC 9, which kitty, Ghostty, iTerm2 and WezTerm read and any
 * other terminal ignores, carrying one line, so title and body are joined there.
 */
export const NOTIFICATION: TerminalFeature<Notification> = {
  name: "notification",
  encodings: [
    {
      name: "OSC 99",
      terminals: ["kitty"],
      failure: "ignored",
      routes: WRAPPED,
      encode: (notification) => {
        const { title, body, id } = shown(notification);
        return body === undefined
          ? `${OSC}99;i=${id};${title}${ST}`
          : `${OSC}99;i=${id}:d=0;${title}${ST}${OSC}99;i=${id}:p=body;${body}${ST}`;
      },
    },
    {
      name: "OSC 777",
      terminals: ["foot", "ghostty"],
      failure: "ignored",
      routes: WRAPPED,
      encode: (notification) => {
        const { title, body } = shown(notification);
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
        const { title, body } = shown(notification);
        const line = body === undefined ? title : `${title}: ${body}`;
        // ConEmu's sub-commands (`9;4;` progress, `9;9;` directory) open with a
        // number and a `;`, and WezTerm and Windows Terminal read them, so a line
        // that would read as one is kept off that shape.
        return `${OSC}9;${/^\d+;/.test(line) ? ` ${line}` : line}${ST}`;
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
 * known size. Shares from every declarer on a frame are summed.
 */
export type TerminalDeclaration = {
  readonly kind: "progress";
  readonly share: { readonly completed: number; readonly total: number } | "indeterminate";
};

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
      routes: { tmux: "passthrough", screen: "passthrough", zellij: "impossible", editor: "impossible" },
      encode: (progress) => {
        const percent = "percent" in progress ? `;${shownPercent(progress.percent)}` : "";
        return `${OSC}9;4;${PROGRESS_CODE[progress.state]}${percent}${ST}`;
      },
    },
  ],
};
