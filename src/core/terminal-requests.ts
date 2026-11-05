/**
 * Sequences a program sends the terminal itself rather than drawing: the
 * window title, the clipboard, a desktop notification. Content can never write
 * a control (`control-codes`), so these are the sanctioned road, and each is
 * written by a named `Console` method that sends nothing when no one is at a
 * terminal. Encoding only: no I/O, and the terminal is read off a
 * `TerminalIdentity`, never off the environment.
 */

import { pattern } from "./pattern.js";
import type { TerminalIdentity } from "./terminal-identity.js";

const ESC = "\x1b";
const OSC = `${ESC}]`;
const ST = `${ESC}\\`;

// What could end the sequence early or start another inside it: C0, DEL, C1.
const CONTROLS = pattern(/[\0-\x1f\x7f-\x9f]/u);

/** `text` without a character that could end an OSC or begin another sequence. */
function inert(text: string): string {
  return Array.from(text, (character) => (CONTROLS.test(character) ? "" : character)).join("");
}

/** OSC 2: the window title. */
export function titleSequence(title: string): string {
  return `${OSC}2;${inert(title)}${ST}`;
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
 * OSC 99 (title, then body, joined by one id), OSC 777 for foot and Ghostty,
 * and iTerm2's OSC 9 elsewhere, which carries one line, so title and body are
 * joined there.
 */
export function notificationSequence(title: string, body: string | undefined, identity: TerminalIdentity): string {
  const shownTitle = inert(title);
  const shownBody = body === undefined ? undefined : inert(body);
  switch (identity.terminal) {
    case "kitty":
      return shownBody === undefined
        ? `${OSC}99;;${shownTitle}${ST}`
        : `${OSC}99;i=1:d=0;${shownTitle}${ST}${OSC}99;i=1:p=body;${shownBody}${ST}`;
    case "foot":
    case "ghostty":
      // A `;` would end 777's title field.
      return `${OSC}777;notify;${shownTitle.replaceAll(";", ",")};${shownBody ?? ""}${ST}`;
    default:
      return `${OSC}9;${shownBody === undefined ? shownTitle : `${shownTitle}: ${shownBody}`}${ST}`;
  }
}

/**
 * `sequence` as it must be written to reach the terminal through `identity`'s
 * intermediary: inside tmux a DCS passthrough with every ESC doubled, which
 * tmux forwards when `allow-passthrough` is on; elsewhere unchanged.
 */
export function throughIntermediary(sequence: string, identity: TerminalIdentity): string {
  return identity.intermediary === "tmux" ? `${ESC}Ptmux;${sequence.replaceAll(ESC, ESC + ESC)}${ST}` : sequence;
}
