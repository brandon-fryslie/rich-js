/**
 * Sequences a program sends the terminal itself rather than drawing: the
 * window title, the clipboard, a desktop notification. Content can never write
 * a control (`control-codes`), so these are the sanctioned road, and each is
 * written by a named `Console` method that sends nothing when no one is at a
 * terminal. Encoding only: no I/O, and the terminal is read off a
 * `TerminalIdentity`, never off the environment.
 */

import { stripOscControls } from "./osc8.js";
import type { TerminalIdentity } from "./terminal-identity.js";

const ESC = "\x1b";
const OSC = `${ESC}]`;
const ST = `${ESC}\\`;
// screen's string buffer (`MAXSTR`, ansi.c), in bytes.
const SCREEN_STRING_MAX = 768;

/** OSC 2: the window title. */
export function titleSequence(title: string): string {
  return `${OSC}2;${stripOscControls(title)}${ST}`;
}

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
 * is then written.
 */
export function pointerShape(value: string): PointerShape {
  if ((POINTER_SHAPES as readonly string[]).includes(value)) return value as PointerShape;
  throw new TypeError(`${JSON.stringify(value)} is not a pointer shape: one of ${POINTER_SHAPES.join(", ")}`);
}

/**
 * OSC 22: the mouse pointer's shape over the terminal. A terminal without it
 * ignores the sequence, as it does any OSC it does not know.
 */
export function pointerSequence(shape: PointerShape): string {
  return `${OSC}22;${shape}${ST}`;
}

/** OSC 52: `text` put on the system clipboard, as base64 of its UTF-8 bytes. */
export function clipboardSequence(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `${OSC}52;c;${btoa(binary)}${ST}`;
}

/**
 * A desktop notification in the protocol `identity`'s terminal reads: kitty's
 * OSC 99, title then body joined by `id`, which must differ per notification or
 * kitty updates the earlier one in place; OSC 777 for foot and Ghostty; and
 * iTerm2's OSC 9 elsewhere, which carries one line, so title and body are joined
 * there. Behind any intermediary the terminal cannot be seen, so it is OSC 9, which
 * kitty, Ghostty, iTerm2 and WezTerm all read.
 */
export function notificationSequence(title: string, body: string | undefined, identity: TerminalIdentity, id: string): string {
  const shownTitle = stripOscControls(title);
  const shownBody = body === undefined ? undefined : stripOscControls(body);
  // Whatever sits between hides the terminal past it, whatever TERM says.
  switch (identity.intermediary === undefined ? identity.terminal : "other") {
    case "kitty":
      return shownBody === undefined
        ? `${OSC}99;i=${id};${shownTitle}${ST}`
        : `${OSC}99;i=${id}:d=0;${shownTitle}${ST}${OSC}99;i=${id}:p=body;${shownBody}${ST}`;
    case "foot":
    case "ghostty":
      // A `;` would end 777's title field.
      return `${OSC}777;notify;${shownTitle.replaceAll(";", ",")};${shownBody ?? ""}${ST}`;
    default: {
      const line = shownBody === undefined ? shownTitle : `${shownTitle}: ${shownBody}`;
      // ConEmu's sub-commands (`9;4;` progress, `9;9;` directory) open with a
      // number and a `;`, and WezTerm and Windows Terminal read them, so a line
      // that would read as one is kept off that shape.
      return `${OSC}9;${/^\d+;/.test(line) ? ` ${line}` : line}${ST}`;
    }
  }
}

/**
 * `sequence` as it must be written to reach the terminal through `identity`'s
 * intermediary: inside tmux its DCS passthrough with every ESC doubled, which
 * tmux forwards when `allow-passthrough` is on; inside screen its bare DCS, or
 * nothing when it is longer than screen holds; elsewhere unchanged. Zellij has no passthrough.
 */
export function throughIntermediary(sequence: string, identity: TerminalIdentity): string {
  switch (identity.intermediary) {
    case "tmux":
      return `${ESC}Ptmux;${sequence.replaceAll(ESC, ESC + ESC)}${ST}`;
    case "screen": {
      // screen ends its DCS at the first ST, so the sequence inside ends in BEL,
      // and cuts one past its buffer, leaving the terminal in an unended OSC that
      // swallows what follows: a request that would not fit is not sent.
      const inner = sequence.replaceAll(ST, "\x07");
      return new TextEncoder().encode(inner).length > SCREEN_STRING_MAX ? "" : `${ESC}P${inner}${ST}`;
    }
    default:
      return sequence;
  }
}
