/**
 * Terminal primitives for the interactive demo — raw mode, key parsing, mouse.
 *
 * Minimal subset, intentionally not a library. Handles what we need:
 * - Enter/leave raw mode
 * - Enable/disable mouse tracking (SGR-1006 extended mode)
 * - Parse key escape sequences into structured events
 * - Parse mouse escape sequences
 */

import type { KeyEvent, WidgetMouseEvent } from "../../src/widgets/types.js";

// --- Terminal raw mode ---

export function enterRawMode(): void {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
}

export function leaveRawMode(): void {
  process.stdin.setRawMode(false);
  process.stdin.pause();
}

// --- Mouse tracking (SGR-1006 extended) ---

export function enableMouse(): void {
  // SGR-1006 extended mouse mode
  process.stdout.write("\x1b[?1006h");
  // Enable mouse button press/release + motion tracking
  process.stdout.write("\x1b[?1000h");
  process.stdout.write("\x1b[?1003h");
}

export function disableMouse(): void {
  process.stdout.write("\x1b[?1003l");
  process.stdout.write("\x1b[?1000l");
  process.stdout.write("\x1b[?1006l");
}

// --- Key parsing ---

const KEY_NAMES: Record<string, string> = {
  "\r": "enter",
  "\n": "enter",
  " ": "space",
  "\x1b": "escape",
  "\x7f": "backspace",
  "\t": "tab",
  "\x1b[Z": "tab", // shift+tab
  "\x1b[A": "up",
  "\x1b[B": "down",
  "\x1b[C": "right",
  "\x1b[D": "left",
  "\x1b[H": "home",
  "\x1b[F": "end",
  "\x1b[1~": "home",
  "\x1b[4~": "end",
  "\x1b[2~": "insert",
  "\x1b[3~": "delete",
  "\x1b[5~": "pageup",
  "\x1b[6~": "pagedown",
};

export function parseKey(data: string): KeyEvent | null {
  // Ctrl+C
  if (data === "\x03") {
    return { key: "c", character: "", ctrl: true, shift: false, meta: false };
  }

  // Shift+tab
  if (data === "\x1b[Z") {
    return { key: "tab", character: "\t", shift: true, ctrl: false, meta: false };
  }

  // Escape sequences
  if (data.startsWith("\x1b[")) {
    const name = KEY_NAMES[data];
    if (name) {
      return { key: name, character: "", shift: false, ctrl: false, meta: false };
    }
    return null;
  }

  // Plain escape
  if (data === "\x1b") {
    return { key: "escape", character: "", shift: false, ctrl: false, meta: false };
  }

  // Single-character keys: check KEY_NAMES first (tab, enter, space, backspace, etc.)
  if (data.length === 1) {
    const name = KEY_NAMES[data];
    if (name) {
      return { key: name, character: name === "space" ? " " : "", shift: false, ctrl: false, meta: false };
    }
  }

  // Ctrl+letter (remaining control chars not in KEY_NAMES)
  if (data.length === 1 && data.charCodeAt(0) < 32) {
    const code = data.charCodeAt(0);
    const letter = String.fromCharCode(code + 96);
    return { key: letter, character: "", ctrl: true, shift: false, meta: false };
  }

  // Printable character
  if (data.length === 1) {
    return {
      key: data.toLowerCase(),
      character: data,
      shift: data !== data.toLowerCase(),
      ctrl: false,
      meta: false,
    };
  }

  return null;
}

// --- Mouse parsing (SGR-1006) ---

// Format: ESC[ < action ; col ; row M (press) or m (release)
const MOUSE_SGR = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])/;

export function parseMouse(data: string): WidgetMouseEvent | null {
  const match = MOUSE_SGR.exec(data);
  if (!match) return null;

  const cb = parseInt(match[1]!, 10);
  const col = parseInt(match[2]!, 10) - 1; // 0-based
  const row = parseInt(match[3]!, 10) - 1;
  const isPress = match[4] === "M";

  const button = cb & 3; // 0=left, 1=middle, 2=right
  const shift = !!(cb & 4);
  const ctrl = !!(cb & 8);
  const isMotion = (cb & 32) !== 0;

  if (isMotion) {
    return { type: "mouse_move", x: col, y: row, button, shift, ctrl };
  }

  return {
    type: isPress ? "mouse_down" : "mouse_up",
    x: col,
    y: row,
    button,
    shift,
    ctrl,
  };
}

// --- Input reader ---

export type InputHandler = (key: KeyEvent | null, mouse: WidgetMouseEvent | null, raw: string) => void;

export function startReading(onInput: InputHandler): () => void {
  let buffer = "";
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    if (buffer.length === 0) return;
    const data = buffer;
    buffer = "";

    // Try mouse first (longer sequences)
    const mouse = parseMouse(data);
    const key = mouse ? null : parseKey(data);
    onInput(key, mouse, data);
  };

  const onData = (chunk: string): void => {
    buffer += chunk;
    // Escape sequences are complete after a short window
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 10);

    // Flush immediately for simple single-byte input
    if (buffer.length === 1 && !buffer.startsWith("\x1b")) {
      flush();
    }
  };

  process.stdin.on("data", onData);

  return () => {
    process.stdin.off("data", onData);
    if (timer) clearTimeout(timer);
  };
}
