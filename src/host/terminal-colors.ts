/**
 * The terminal's own foreground and background, asked of it with OSC 10 and
 * OSC 11 — the colors every contrast decision is measured against, which the
 * library otherwise has to assume.
 *
 * [LAW:effects-at-boundaries] The ask is `App`'s, the one reader of its
 * terminal's input; what is here is the query bytes and the parse of their
 * replies, which stays pure.
 */

import { ColorRgba, TerminalColors } from "../core/color.js";
import { pattern } from "../core/pattern.js";
import type { App } from "./app.js";
import type { TerminalReply } from "./input.js";

// OSC 10 and OSC 11 with `?` ask for the dynamic foreground and background.
const QUERIES = ["\x1b]10;?\x1b\\", "\x1b]11;?\x1b\\"] as const;

// XParseColor's `rgb:` form, 1–4 hex digits a channel, as xterm and every
// terminal that copies it answers, or `rgba:`, as urxvt answers with
// transparency on; the alpha says nothing about the color a cell is drawn in.
const RGB = pattern(/^rgba?:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})(?:\/[0-9a-f]{1,4})?$/i);

// A channel of n hex digits is a fraction of 16ⁿ − 1, scaled to 8 bits.
const channel = (hex: string): number => Math.round((parseInt(hex, 16) / (16 ** hex.length - 1)) * 255);

/**
 * The color an OSC 10 or OSC 11 reply reports, or `undefined` when `reply`
 * is not that answer to `slot`.
 */
function parseColorReply(reply: TerminalReply, slot: 10 | 11): ColorRgba | undefined {
  if (reply.kind !== "osc") return undefined;
  const prefix = `${slot};`;
  if (!reply.body.startsWith(prefix)) return undefined;
  const match = RGB.exec(reply.body.slice(prefix.length));
  return match === null ? undefined : new ColorRgba(channel(match[1]!), channel(match[2]!), channel(match[3]!));
}

/**
 * Ask the terminal `app` runs on for its foreground and background, and return
 * the terminal `app` draws on with them in place — its sixteen ANSI colors
 * kept, since nothing asks for those. `undefined` when the terminal did not
 * answer both, so the caller keeps what it had. Set it as `app.terminal`.
 */
export async function terminalColors(app: App): Promise<TerminalColors | undefined> {
  const { replies } = await app.ask(QUERIES);
  const foreground = replies.map((reply) => parseColorReply(reply, 10)).find((color) => color !== undefined);
  const background = replies.map((reply) => parseColorReply(reply, 11)).find((color) => color !== undefined);
  if (foreground === undefined || background === undefined) return undefined;
  return new TerminalColors(background, foreground, app.terminal.ansiColors, app.terminal.mutedSlot);
}
