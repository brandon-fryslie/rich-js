/**
 * Terminal input: the bytes a terminal sends for keys and the pointer,
 * parsed into `KeyPress` and `ScreenMouseEvent` values, and the one name
 * each key goes by.
 *
 * [LAW:single-enforcer] Escape-sequence parsing lives only here. `App` owns
 * the one parser over its host's input; a `WidgetApp` routes the events `App`
 * hears, and no program reads its terminal's bytes itself.
 *
 * [LAW:dataflow-not-control-flow] The same parse pipeline runs for every
 * input chunk: append → consume one event at a time until the buffer can't
 * yield more. The byte's value, not a side-mode, decides which event is
 * emitted. There is no "are we mid-sequence" mode flag — the buffer head
 * carries all the state we need, so a UTF-8 character or an escape sequence
 * split across two chunks is completed by the second.
 *
 * Lone-ESC handling: a bare `\x1b` is ambiguous (escape key vs. start of a
 * CSI sequence). When the buffer is drained but ends with a lone ESC, the
 * parser defers emission via setTimeout(0), and likewise an ESC followed only
 * by `[` or `O`. A next chunk opening with `[` or `O` extends a lone ESC; any
 * other next chunk emits it as Escape first. When the timer runs, or on
 * `flush()`, the held ESC is Escape and the bytes after it are keys.
 */

/** A key as the terminal reported it: plain data, with no say over who hears it. */
export interface KeyPress {
  readonly key: string;
  /** The printable character the key types, or "" for a key that types none. */
  readonly character: string;
  readonly shift: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
}

// [LAW:one-source-of-truth] Mouse types are exactly what the parser emits.
// There is no "click" — clicks are derived by handlers from mouse_down +
// mouse_up pairs on the same widget. Keeping unreachable values in the
// union would force every consumer to handle a case that never arrives.
// `x`/`y` are the terminal cell under the pointer. One member per `type`, so
// a check of `type` narrows the whole event.
export type ScreenMouseEvent = { [T in MouseEventType]: MouseEventOf<T> }[MouseEventType];

type MouseEventType =
  | "mouse_down"
  | "mouse_up"
  | "mouse_move"
  | "scroll_up"
  | "scroll_down"
  | "scroll_left"
  | "scroll_right";

interface MouseEventOf<Type extends string> {
  readonly type: Type;
  readonly x: number;
  readonly y: number;
  readonly button: number;
  readonly shift: boolean;
  readonly ctrl: boolean;
}

/**
 * The one name a key goes by — what a keymap is keyed by and what
 * `quitKeys` lists. A key that types a character is named by it (`q`, `G`,
 * `>`); any other is named by its key (`up`, `enter`, `space`, `f5`). Held
 * modifiers come first, always in the order `ctrl+`, `meta+`, `shift+`:
 * `ctrl+c`, `shift+tab`, `meta+left`. Shift is not named on a character,
 * which already carries it: Shift+G is `G`.
 */
export function keyName(press: KeyPress): string {
  const typed = press.character !== "" && press.key !== "space";
  const modifiers = [
    press.ctrl ? "ctrl+" : "",
    press.meta ? "meta+" : "",
    press.shift && !typed ? "shift+" : "",
  ];
  return modifiers.join("") + (typed ? press.character : press.key);
}

/** Where a parser delivers what it parses. */
export interface InputSink {
  key(press: KeyPress): void;
  mouse(event: ScreenMouseEvent): void;
}

// Single-byte → key name table for the trivial cases.
const SINGLE_BYTE_KEYS: Record<number, string> = {
  0x09: "tab",
  0x0a: "enter",
  0x0d: "enter",
  0x1b: "escape",
  0x08: "backspace",
  0x7f: "backspace",
  0x20: "space",
};

// Final-byte → key name for the simple `ESC[<X>` arrow / nav forms.
const CSI_LETTER_KEYS: Record<string, string> = {
  A: "up",
  B: "down",
  C: "right",
  D: "left",
  H: "home",
  F: "end",
  Z: "tab", // shift+tab encodes as ESC[Z
};

// `ESC[<n>~` numeric forms for navigation / function keys.
const CSI_TILDE_KEYS: Record<string, string> = {
  "1": "home",
  "2": "insert",
  "3": "delete",
  "4": "end",
  "5": "pageup",
  "6": "pagedown",
  "7": "home",
  "8": "end",
  "11": "f1",
  "12": "f2",
  "13": "f3",
  "14": "f4",
  "15": "f5",
  "17": "f6",
  "18": "f7",
  "19": "f8",
  "20": "f9",
  "21": "f10",
  "23": "f11",
  "24": "f12",
};

// SS3 form `ESC O X` for F1–F4 (and arrow keys on some terminals).
const SS3_KEYS: Record<string, string> = {
  P: "f1",
  Q: "f2",
  R: "f3",
  S: "f4",
  A: "up",
  B: "down",
  C: "right",
  D: "left",
  H: "home",
  F: "end",
};

// Every name a key with no glyph goes by.
const NAMED_KEYS: ReadonlySet<string> = new Set([
  ...Object.values(SINGLE_BYTE_KEYS),
  ...Object.values(CSI_LETTER_KEYS),
  ...Object.values(CSI_TILDE_KEYS),
  ...Object.values(SS3_KEYS),
]);

// [LAW:one-source-of-truth] The glyphs a Ctrl chord is named by are what
// `ctrlKey` makes of the control bytes no named key claims.
const CTRL_GLYPHS: ReadonlySet<string> = new Set(
  Array.from({ length: 0x20 }, (_, byte) => byte)
    .filter((byte) => byte !== 0 && !(byte in SINGLE_BYTE_KEYS))
    .map((byte) => ctrlKey(byte).key),
);

/**
 * `name`, if `keyName` can produce it: modifiers in its order, then a named
 * key or one glyph, with no `shift+` on a glyph and, after `ctrl+`, only a
 * glyph a control byte stands for.
 * [LAW:parse-dont-validate] A name no key can produce throws here, at the
 * one place a program hands names in, rather than binding a key that never fires.
 */
export function parseKeyName(name: string): string {
  const [, ctrl, , shift, base] = /^(ctrl\+)?(meta\+)?(shift\+)?(.*)$/u.exec(name)!;
  const glyph = [...base!].length === 1 && !shift && (!ctrl || CTRL_GLYPHS.has(base!));
  const producible = NAMED_KEYS.has(base!) || glyph;
  if (!producible) throw new Error(`no key is named ${JSON.stringify(name)}; see keyName`);
  return name;
}

const ESC = 0x1b;
const LBRACKET = 0x5b; // [
const LANGLE = 0x3c; // <
const O_BYTE = 0x4f; // O
const M_UPPER = 0x4d; // M
const M_LOWER = 0x6d; // m

// [LAW:single-enforcer] Shared encode/decode singletons. The parser
// receives `Uint8Array | string` from the host and walks bytes through
// its state machine; conversion happens at the two boundaries (string
// input → bytes via TextEncoder; printable-byte run → JS string via
// TextDecoder) and only there. Module-level instances keep the seam
// allocation-free and runtime-agnostic — both APIs are universal across
// node and browser.
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder("utf-8");
const ASCII_DECODER = new TextDecoder("ascii");

const EMPTY_BYTES = new Uint8Array(0);

// Concatenate two byte arrays into a fresh Uint8Array. Replaces
// `Buffer.concat([...])` so the parser holds no node-specific globals.
function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const merged = new Uint8Array(a.length + b.length);
  merged.set(a, 0);
  merged.set(b, a.length);
  return merged;
}

// A lone ESC, or one with only a CSI/SS3 introducer after it: bytes that are
// Escape (then `[` or `O`) unless more of a sequence follows.
function holdsEscape(buf: Uint8Array): boolean {
  if (buf[0] !== ESC) return false;
  return buf.length === 1 || (buf.length === 2 && (buf[1] === LBRACKET || buf[1] === O_BYTE));
}

// Result of attempting to consume one event from the head of the buffer.
type ConsumeResult =
  | { kind: "key"; bytes: number; event: KeyPress }
  | { kind: "mouse"; bytes: number; event: ScreenMouseEvent }
  | { kind: "incomplete" } // need more bytes
  | { kind: "skip"; bytes: number }; // unrecognised — drop bytes

export class InputParser {
  // [LAW:types-are-the-program] The parse buffer is `Uint8Array`, not
  // `Buffer` — node's Buffer extends Uint8Array, so Buffer chunks from
  // process.stdin satisfy this type, while a browser host can emit native
  // Uint8Array without depending on a Buffer global polyfill.
  private buffer: Uint8Array = EMPTY_BYTES;
  // [LAW:types-are-the-program] `setTimeout`/`clearTimeout` are universal
  // across node and browser; `setImmediate` is node-only.
  private escTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly sink: InputSink) {}

  /** Feed a chunk of bytes (or a string of them) into the parser. */
  feed(chunk: Uint8Array | string): void {
    const next = typeof chunk === "string" ? UTF8_ENCODER.encode(chunk) : chunk;
    // A held lone ESC waits only for the rest of a split CSI/SS3 introducer.
    // Any other next chunk means Escape was its own key, even when the hold
    // timer has not run yet: a busy worker can queue the next key ahead of it,
    // and joining them would read Escape then G as Alt+G (rich-host-input-0c4f).
    const escaped =
      this.buffer.length === 1 && this.buffer[0] === ESC && next.length > 0 &&
      next[0] !== LBRACKET && next[0] !== O_BYTE;
    this.cancelEscape();
    // The buffer is settled before the sink hears Escape, so a sink that
    // resets the parser on it (an app stopping) leaves nothing to drain.
    this.buffer = concatBytes(escaped ? EMPTY_BYTES : this.buffer, next);
    if (escaped) this.sink.key(ESCAPE);
    this.drain();
    // [LAW:dataflow-not-control-flow] If a held ESC remains, defer emission
    // until the next macrotask so a follow-up chunk can extend it.
    if (holdsEscape(this.buffer)) {
      this.escTimer = setTimeout(() => {
        this.escTimer = undefined;
        this.flush();
      }, 0);
    }
  }

  /**
   * Force a held ESC out of the buffer as Escape, and what it held after it —
   * a `[` or `O` that opened no sequence — as the keys they are.
   */
  flush(): void {
    this.cancelEscape();
    if (!holdsEscape(this.buffer)) return;
    this.buffer = this.buffer.subarray(1);
    this.sink.key(ESCAPE);
    this.drain();
  }

  /** Drop what is buffered and any pending lone ESC: the parser as constructed. */
  reset(): void {
    this.cancelEscape();
    this.buffer = EMPTY_BYTES;
  }

  private cancelEscape(): void {
    clearTimeout(this.escTimer);
    this.escTimer = undefined;
  }

  private drain(): void {
    while (this.buffer.length > 0) {
      const result = this.consumeOne(this.buffer);
      if (result.kind === "incomplete") return;
      this.buffer = this.buffer.subarray(result.bytes);
      if (result.kind === "key") this.sink.key(result.event);
      else if (result.kind === "mouse") this.sink.mouse(result.event);
      // skip → drop bytes silently
    }
  }

  private consumeOne(buf: Uint8Array): ConsumeResult {
    const b0 = buf[0]!;

    if (b0 === ESC) return this.consumeEscape(buf);

    // Ctrl+C
    if (b0 === 0x03) {
      return {
        kind: "key",
        bytes: 1,
        event: ({ key: "c", character: "", shift: false, ctrl: true, meta: false }),
      };
    }

    // Named single-byte keys (tab/enter/space/backspace).
    const named = SINGLE_BYTE_KEYS[b0];
    if (named && named !== "escape") {
      return {
        kind: "key",
        bytes: 1,
        event: ({
          key: named,
          character: named === "space" ? " " : "",
          shift: false,
          ctrl: false,
          meta: false,
        }),
      };
    }

    if (b0 < 0x20) return { kind: "key", bytes: 1, event: ctrlKey(b0) };

    // Printable ASCII / start of a UTF-8 multibyte character.
    return this.consumePrintable(buf);
  }

  private consumePrintable(buf: Uint8Array): ConsumeResult {
    const b0 = buf[0]!;
    let len = 1;
    if (b0 >= 0xc0 && b0 < 0xe0) len = 2;
    else if (b0 >= 0xe0 && b0 < 0xf0) len = 3;
    else if (b0 >= 0xf0) len = 4;
    if (buf.length < len) return { kind: "incomplete" };

    const character = UTF8_DECODER.decode(buf.subarray(0, len));
    return {
      kind: "key",
      bytes: len,
      event: ({
        key: character.toLowerCase(),
        character,
        shift: character.length === 1 && character !== character.toLowerCase(),
        ctrl: false,
        meta: false,
      }),
    };
  }

  private consumeEscape(buf: Uint8Array): ConsumeResult {
    if (buf.length === 1) return { kind: "incomplete" };
    const b1 = buf[1]!;

    // ESC [ ... → CSI
    if (b1 === LBRACKET) return this.consumeCSI(buf);
    // ESC O X → SS3 (F1–F4 / arrows on some terms)
    if (b1 === O_BYTE) return this.consumeSS3(buf);
    // ESC ESC [ … / ESC ESC O … → Alt on a key the terminal sends as a
    // sequence (macOS Terminal and iTerm send Option+Up as `ESC ESC [ A`): the
    // inner sequence, with meta held.
    if (b1 === ESC && buf.length > 2 && (buf[2] === LBRACKET || buf[2] === O_BYTE)) {
      // A pointer report is never Alt-prefixed (SGR carries modifiers in its
      // button byte), so before anything but a key the first ESC is Escape.
      const inner = this.consumeEscape(buf.subarray(1));
      if (inner.kind === "incomplete") return inner;
      if (inner.kind === "key") {
        return { kind: "key", bytes: inner.bytes + 1, event: { ...inner.event, meta: true } };
      }
      return { kind: "key", bytes: 1, event: ESCAPE };
    }
    // ESC ESC → escape key (some terminals double-send). Consume BOTH bytes
    // so the user sees one escape event, not two. Without this, the second
    // ESC remained in the buffer and produced a second escape via the
    // lone-ESC flush path.
    if (b1 === ESC) {
      return {
        kind: "key",
        bytes: 2,
        event: ({ key: "escape", character: "", shift: false, ctrl: false, meta: false }),
      };
    }
    // ESC <named> / ESC <printable> → Alt-modified key.
    // Terminals encode Alt+<key> as the literal byte preceded by ESC, so
    // `ESC b` is Alt+B, `ESC <0x7f>` is Alt+Backspace, `ESC <0x20>` is
    // Alt+Space, etc. The parser surfaces this as `{ key, meta: true }` —
    // matching the shape used for Ctrl-modified keys, so handlers can
    // branch on `event.meta` without parsing escape sequences themselves.
    //
    // [LAW:one-source-of-truth] Named single-byte keys (space, tab,
    // enter, backspace) use the SAME canonical key names on the Alt path
    // as on the non-Alt path. Without this, `Alt+Space` decoded as
    // `key: " "` while a bare space decoded as `key: "space"`, so a
    // handler couldn't match Alt+Space via `event.key === "space" &&
    // event.meta`. Routing through SINGLE_BYTE_KEYS first preserves the
    // canonical naming.
    //
    // [LAW:one-source-of-truth] Modifier decoding for *all* navigation keys
    // lives in this file: CSI param-style modifiers (e.g. `ESC[1;3D` for
    // Alt+Left) flow through `decodeModifier`, and ESC-prefixed Alt forms
    // flow through this branch. Widgets read `event.meta` and never re-parse.
    const namedAlt = SINGLE_BYTE_KEYS[b1];
    if (namedAlt && namedAlt !== "escape") {
      return {
        kind: "key",
        bytes: 2,
        event: ({
          key: namedAlt,
          character: "",
          shift: false,
          ctrl: false,
          meta: true,
        }),
      };
    }
    // The key is the glyph the terminal sent, as for Alt+`>`: the glyph
    // already carries shift, so Alt+G is `meta+G` and never `meta+shift+g`.
    if (b1 >= 0x20 && b1 <= 0x7e) {
      const ch = String.fromCharCode(b1);
      return {
        kind: "key",
        bytes: 2,
        event: ({ key: ch, character: "", shift: false, ctrl: false, meta: true }),
      };
    }
    // ESC <control byte> is read as Escape, then the Ctrl chord — never as
    // Alt+Ctrl. The bytes cannot tell the two apart, and Escape then Ctrl+C
    // typed during a stalled frame must still reach the quit keys as Ctrl+C.
    // Any other byte after ESC (a UTF-8 lead) is likewise re-read on its own.
    return {
      kind: "key",
      bytes: 1,
      event: ({ key: "escape", character: "", shift: false, ctrl: false, meta: false }),
    };
  }

  private consumeSS3(buf: Uint8Array): ConsumeResult {
    if (buf.length < 3) return { kind: "incomplete" };
    const final = String.fromCharCode(buf[2]!);
    const name = SS3_KEYS[final];
    if (!name) return { kind: "skip", bytes: 3 };
    return {
      kind: "key",
      bytes: 3,
      event: ({ key: name, character: "", shift: false, ctrl: false, meta: false }),
    };
  }

  private consumeCSI(buf: Uint8Array): ConsumeResult {
    // buf starts with ESC [
    const next = buf[2];
    if (next === undefined) return { kind: "incomplete" };

    // X10 mouse: ESC [ M b x y  (3 raw bytes after M)
    if (next === M_UPPER) {
      if (buf.length < 6) return { kind: "incomplete" };
      const cb = buf[3]! - 32;
      const col = buf[4]! - 32 - 1;
      const row = buf[5]! - 32 - 1;
      return { kind: "mouse", bytes: 6, event: decodeMouseFromCb(cb, col, row, true) };
    }

    // SGR mouse: ESC [ < cb ; x ; y M|m
    if (next === LANGLE) {
      // Find terminator M or m.
      for (let i = 3; i < buf.length; i++) {
        const b = buf[i]!;
        if (b === M_UPPER || b === M_LOWER) {
          const params = ASCII_DECODER.decode(buf.subarray(3, i));
          const parts = params.split(";");
          if (parts.length !== 3) return { kind: "skip", bytes: i + 1 };
          const cb = parseInt(parts[0]!, 10);
          const col = parseInt(parts[1]!, 10) - 1;
          const row = parseInt(parts[2]!, 10) - 1;
          if (Number.isNaN(cb) || Number.isNaN(col) || Number.isNaN(row)) {
            return { kind: "skip", bytes: i + 1 };
          }
          return {
            kind: "mouse",
            bytes: i + 1,
            event: decodeMouseFromCb(cb, col, row, b === M_UPPER),
          };
        }
      }
      return { kind: "incomplete" };
    }

    // Generic CSI: collect parameter / intermediate bytes until a final byte
    // in the range 0x40–0x7e is found.
    let params = "";
    for (let i = 2; i < buf.length; i++) {
      const b = buf[i]!;
      if (b >= 0x40 && b <= 0x7e) {
        const final = String.fromCharCode(b);
        return decodeCSI(params, final, i + 1);
      }
      params += String.fromCharCode(b);
    }
    return { kind: "incomplete" };
  }
}

// --- Helpers ---

// The wheel's button bits: vertical, then the horizontal wheel or tilt.
const SCROLL = ["scroll_up", "scroll_down", "scroll_left", "scroll_right"] as const;

// A C0 control byte as the Ctrl chord that types it, with Alt held or not.
// 0x00 is Ctrl+Space; 0x01–0x1a are Ctrl+A–Z; 0x1c–0x1f are Ctrl+\ ] ^ _.
// The bytes SINGLE_BYTE_KEYS names (tab, enter, backspace, escape) never reach here.
function ctrlKey(byte: number): KeyPress {
  const key = byte === 0 ? "space" : String.fromCharCode(byte + (byte <= 0x1a ? 0x60 : 0x40));
  return { key, character: "", shift: false, ctrl: true, meta: false };
}

const ESCAPE: KeyPress = { key: "escape", character: "", shift: false, ctrl: false, meta: false };

function decodeMouseFromCb(
  cb: number,
  x: number,
  y: number,
  isPress: boolean,
): ScreenMouseEvent {
  const isMotion = (cb & 32) !== 0;
  const isScroll = (cb & 64) !== 0;
  const button = cb & 3;
  const shift = !!(cb & 4);
  const ctrl = !!(cb & 16); // bit 16 = ctrl in xterm encoding

  if (isScroll) return { type: SCROLL[button]!, x, y, button: 0, shift, ctrl };
  if (isMotion) {
    return { type: "mouse_move", x, y, button, shift, ctrl };
  }
  return {
    type: isPress ? "mouse_down" : "mouse_up",
    x,
    y,
    button,
    shift,
    ctrl,
  };
}

function decodeCSI(params: string, final: string, bytes: number): ConsumeResult {
  // Handle modifier suffixes like `1;2A` (shift+up). We split params on `;`.
  const parts = params.split(";");
  const first = parts[0] ?? "";
  const mod = parseInt(parts[1] ?? "", 10);
  const { shift, ctrl, meta } = decodeModifier(mod);

  if (final === "~") {
    const name = CSI_TILDE_KEYS[first];
    if (!name) return { kind: "skip", bytes };
    return {
      kind: "key",
      bytes,
      event: ({ key: name, character: "", shift, ctrl, meta }),
    };
  }

  const name = CSI_LETTER_KEYS[final];
  if (!name) return { kind: "skip", bytes };

  // Special case: ESC[Z is shift+tab regardless of explicit modifier.
  // [LAW:one-source-of-truth] `character` is the printable character the
  // key would produce, or "" for non-printable / modifier-only events.
  // The non-shifted tab path emits character: "" (Tab is named, not
  // printed) — keep shift+tab consistent. Distinguish via key === "tab"
  // + shift, not character.
  if (final === "Z") {
    return {
      kind: "key",
      bytes,
      event: ({ key: "tab", character: "", shift: true, ctrl: false, meta: false }),
    };
  }

  return {
    kind: "key",
    bytes,
    event: ({ key: name, character: "", shift, ctrl, meta }),
  };
}

function decodeModifier(mod: number): { shift: boolean; ctrl: boolean; meta: boolean } {
  if (!Number.isFinite(mod) || mod <= 1) {
    return { shift: false, ctrl: false, meta: false };
  }
  const bits = mod - 1;
  return {
    shift: (bits & 1) !== 0,
    meta: (bits & 2) !== 0,
    ctrl: (bits & 4) !== 0,
  };
}
