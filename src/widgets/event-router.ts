/**
 * EventRouter — parses raw stdin into KeyEvent / WidgetMouseEvent values
 * and dispatches them to widgets via the Screen's FocusManager and bounds.
 *
 * [LAW:single-enforcer] ANSI escape parsing lives only here — widgets never
 * see raw bytes. One parser, one dispatch surface.
 *
 * [LAW:dataflow-not-control-flow] The same parse pipeline runs for every
 * input chunk: append → consume one event at a time until the buffer can't
 * yield more. The byte's value, not a side-mode, decides which event is
 * emitted. There is no "are we mid-sequence" mode flag — the buffer head
 * carries all the state we need.
 *
 * Lone-ESC handling: a bare `\x1b` is ambiguous (escape key vs. start of a
 * CSI sequence). When the buffer is drained but ends with a lone ESC, the
 * router defers emission via setImmediate. The next chunk cancels the timer
 * if it extends the sequence. Tests can call `flush()` to drain synchronously.
 */

import type {
  Screen,
  FocusManager,
  InteractiveWidget,
  KeyEvent,
  WidgetMouseEvent,
  Unsubscribe,
} from "./types.js";

type WidgetSource = {
  focusManager: FocusManager;
  getWidgets: () => readonly InteractiveWidget[];
};

export interface EventRouterOptions {
  screen: Screen | WidgetSource;
  input?: NodeJS.ReadableStream & {
    setRawMode?: (raw: boolean) => unknown;
    isTTY?: boolean;
  };
  output?: NodeJS.WritableStream;
  /**
   * When true (default when output is a TTY), enable mouse tracking on
   * start() and disable on stop(). Disable in tests / non-TTY environments.
   */
  manageMouse?: boolean;
  /**
   * When true (default when input is a TTY), put stdin into raw mode on
   * start() and restore on stop().
   */
  manageRawMode?: boolean;
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

const ESC = 0x1b;
const LBRACKET = 0x5b; // [
const LANGLE = 0x3c; // <
const O_BYTE = 0x4f; // O
const M_UPPER = 0x4d; // M
const M_LOWER = 0x6d; // m

const MOUSE_TRACK_ON = "\x1b[?1006h\x1b[?1000h\x1b[?1003h";
const MOUSE_TRACK_OFF = "\x1b[?1003l\x1b[?1000l\x1b[?1006l";

// Result of attempting to consume one event from the head of the buffer.
type ConsumeResult =
  | { kind: "key"; bytes: number; event: KeyEvent }
  | { kind: "mouse"; bytes: number; event: WidgetMouseEvent }
  | { kind: "incomplete" } // need more bytes
  | { kind: "skip"; bytes: number }; // unrecognised — drop bytes

export class EventRouter {
  private readonly source: WidgetSource;
  private readonly input: EventRouterOptions["input"];
  private readonly output: NodeJS.WritableStream;
  private readonly manageMouse: boolean;
  private readonly manageRawMode: boolean;

  private buffer: Buffer = Buffer.alloc(0);
  private running = false;
  private dataListener: ((chunk: Buffer | string) => void) | undefined;
  private escTimer: ReturnType<typeof setImmediate> | undefined;
  // [LAW:single-enforcer] Mouse capture: the widget that received `mouse_down`
  // owns the subsequent `mouse_move` / `mouse_up` events until release, even
  // if the pointer leaves its bounds. This lets Slider drag stay live and
  // Dropdown receive the outside-click that collapses it. Capture is data,
  // not a mode — the same dispatch pipeline runs every event.
  private mouseCapture: InteractiveWidget | null = null;

  private readonly keyHandlers = new Set<(event: KeyEvent) => void>();
  private readonly mouseHandlers = new Set<(event: WidgetMouseEvent) => void>();

  constructor(options: EventRouterOptions) {
    const { screen } = options;
    this.source = isWidgetSource(screen)
      ? screen
      : { focusManager: screen.focusManager, getWidgets: () => screen.widgets };

    this.input = options.input ?? (process.stdin as EventRouterOptions["input"]);
    this.output = options.output ?? process.stdout;

    const inputIsTTY = !!this.input?.isTTY;
    const outputIsTTY = !!(this.output as NodeJS.WriteStream).isTTY;
    this.manageRawMode = options.manageRawMode ?? inputIsTTY;
    this.manageMouse = options.manageMouse ?? outputIsTTY;
  }

  // --- Lifecycle ---

  start(): void {
    if (this.running) return;
    this.running = true;

    if (this.manageRawMode && this.input?.setRawMode) {
      this.input.setRawMode(true);
    }
    if (typeof (this.input as { resume?: () => void })?.resume === "function") {
      (this.input as { resume: () => void }).resume();
    }

    if (this.manageMouse) this.output.write(MOUSE_TRACK_ON);

    this.dataListener = (chunk: Buffer | string) => this.feed(chunk);
    this.input?.on("data", this.dataListener);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.dataListener) {
      this.input?.off("data", this.dataListener);
      this.dataListener = undefined;
    }
    if (this.escTimer) {
      clearImmediate(this.escTimer);
      this.escTimer = undefined;
    }
    this.mouseCapture = null;

    if (this.manageMouse) this.output.write(MOUSE_TRACK_OFF);
    if (this.manageRawMode && this.input?.setRawMode) {
      this.input.setRawMode(false);
    }
  }

  // --- External hooks ---

  onKey(handler: (event: KeyEvent) => void): Unsubscribe {
    this.keyHandlers.add(handler);
    return () => this.keyHandlers.delete(handler);
  }

  onMouse(handler: (event: WidgetMouseEvent) => void): Unsubscribe {
    this.mouseHandlers.add(handler);
    return () => this.mouseHandlers.delete(handler);
  }

  // --- Test / advanced API ---

  /** Feed a chunk of bytes (or a string of bytes) into the parser. */
  feed(chunk: Buffer | string): void {
    const next = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
    this.buffer = this.buffer.length === 0 ? Buffer.from(next) : Buffer.concat([this.buffer, next]);
    if (this.escTimer) {
      clearImmediate(this.escTimer);
      this.escTimer = undefined;
    }
    this.drain();
    // [LAW:dataflow-not-control-flow] If a lone ESC remains, defer emission
    // until the next macrotask so a follow-up chunk can extend it.
    if (this.buffer.length === 1 && this.buffer[0] === ESC) {
      this.escTimer = setImmediate(() => {
        this.escTimer = undefined;
        this.flush();
      });
    }
  }

  /** Force any pending lone ESC out of the buffer. */
  flush(): void {
    if (this.escTimer) {
      clearImmediate(this.escTimer);
      this.escTimer = undefined;
    }
    if (this.buffer.length > 0 && this.buffer[0] === ESC && this.buffer.length === 1) {
      this.buffer = this.buffer.subarray(1);
      this.dispatchKey({ key: "escape", character: "", shift: false, ctrl: false, meta: false });
    }
  }

  // --- Internals ---

  private drain(): void {
    while (this.buffer.length > 0) {
      const result = this.consumeOne(this.buffer);
      if (result.kind === "incomplete") return;
      this.buffer = this.buffer.subarray(result.bytes);
      if (result.kind === "key") this.dispatchKey(result.event);
      else if (result.kind === "mouse") this.dispatchMouse(result.event);
      // skip → drop bytes silently
    }
  }

  private consumeOne(buf: Buffer): ConsumeResult {
    const b0 = buf[0]!;

    if (b0 === ESC) return this.consumeEscape(buf);

    // Ctrl+C
    if (b0 === 0x03) {
      return {
        kind: "key",
        bytes: 1,
        event: { key: "c", character: "", shift: false, ctrl: true, meta: false },
      };
    }

    // Named single-byte keys (tab/enter/space/backspace).
    const named = SINGLE_BYTE_KEYS[b0];
    if (named && named !== "escape") {
      return {
        kind: "key",
        bytes: 1,
        event: {
          key: named,
          character: named === "space" ? " " : "",
          shift: false,
          ctrl: false,
          meta: false,
        },
      };
    }

    // Ctrl+letter (Ctrl+A=0x01 .. Ctrl+Z=0x1a), excluding the bytes already
    // claimed by SINGLE_BYTE_KEYS above (tab=0x09, enter=0x0a/0x0d, backspace=0x08).
    if (b0 < 0x20) {
      const letter = String.fromCharCode(b0 + 0x60); // 0x01 → 'a'
      return {
        kind: "key",
        bytes: 1,
        event: { key: letter, character: "", shift: false, ctrl: true, meta: false },
      };
    }

    // Printable ASCII / start of a UTF-8 multibyte character.
    return this.consumePrintable(buf);
  }

  private consumePrintable(buf: Buffer): ConsumeResult {
    const b0 = buf[0]!;
    let len = 1;
    if (b0 >= 0xc0 && b0 < 0xe0) len = 2;
    else if (b0 >= 0xe0 && b0 < 0xf0) len = 3;
    else if (b0 >= 0xf0) len = 4;
    if (buf.length < len) return { kind: "incomplete" };

    const character = buf.subarray(0, len).toString("utf8");
    return {
      kind: "key",
      bytes: len,
      event: {
        key: character.toLowerCase(),
        character,
        shift: character.length === 1 && character !== character.toLowerCase(),
        ctrl: false,
        meta: false,
      },
    };
  }

  private consumeEscape(buf: Buffer): ConsumeResult {
    if (buf.length === 1) return { kind: "incomplete" };
    const b1 = buf[1]!;

    // ESC [ ... → CSI
    if (b1 === LBRACKET) return this.consumeCSI(buf);
    // ESC O X → SS3 (F1–F4 / arrows on some terms)
    if (b1 === O_BYTE) return this.consumeSS3(buf);
    // ESC ESC → escape key (some terminals double-send). Consume both bytes so
    // the second ESC doesn't re-enter the lone-ESC timer and produce a phantom
    // duplicate event.
    if (b1 === ESC) {
      return {
        kind: "key",
        bytes: 2,
        event: { key: "escape", character: "", shift: false, ctrl: false, meta: false },
      };
    }
    // ESC <any other byte> → unrecognised sequence; emit Escape for the lone ESC
    // (bytes: 1 consumed), then b1 is re-processed on the next call.
    return {
      kind: "key",
      bytes: 1,
      event: { key: "escape", character: "", shift: false, ctrl: false, meta: false },
    };
  }

  private consumeSS3(buf: Buffer): ConsumeResult {
    if (buf.length < 3) return { kind: "incomplete" };
    const final = String.fromCharCode(buf[2]!);
    const name = SS3_KEYS[final];
    if (!name) return { kind: "skip", bytes: 3 };
    return {
      kind: "key",
      bytes: 3,
      event: { key: name, character: "", shift: false, ctrl: false, meta: false },
    };
  }

  private consumeCSI(buf: Buffer): ConsumeResult {
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
          const params = buf.subarray(3, i).toString("ascii");
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

  // --- Dispatch ---

  private dispatchKey(event: KeyEvent): void {
    for (const handler of this.keyHandlers) handler(event);

    if (event.key === "tab") {
      if (event.shift) this.source.focusManager.prev();
      else this.source.focusManager.next();
      return;
    }

    this.source.focusManager.current?.handleKey(event);
  }

  private dispatchMouse(event: WidgetMouseEvent): void {
    for (const handler of this.mouseHandlers) handler(event);

    const widgets = this.source.getWidgets();

    // Hover tracking is independent of capture — it always reflects which
    // widget the pointer is physically over, regardless of which widget owns
    // the gesture. Slider dragging outside its own bounds therefore clears
    // its hover even while it keeps receiving mouse_move events.
    if (event.type === "mouse_move") {
      for (const w of widgets) {
        if (!w.visible) continue;
        const inside = w.containsPoint(event.x, event.y);
        if (inside !== w.hovered) w.setHovered(inside);
      }
    }

    // [LAW:dataflow-not-control-flow] Resolve target as data: capture wins
    // for mid-gesture move/up events; everything else falls back to the
    // topmost-hit widget. Mouse_down also seeds the capture.
    const hit = topmostHit(widgets, event.x, event.y);
    const target = pickMouseTarget(this.mouseCapture, hit, event.type);
    if (event.type === "mouse_down") this.mouseCapture = hit;
    if (event.type === "mouse_up") this.mouseCapture = null;

    if (target) target.handleMouse(event);
  }
}

function topmostHit(
  widgets: readonly InteractiveWidget[],
  x: number,
  y: number,
): InteractiveWidget | null {
  for (let i = widgets.length - 1; i >= 0; i--) {
    const w = widgets[i]!;
    if (!w.visible) continue;
    if (!w.containsPoint(x, y)) continue;
    return w;
  }
  return null;
}

// [LAW:dataflow-not-control-flow] Target selection is a pure function of
// (capture, hit, event-type). `mouse_move` and `mouse_up` honour capture so
// drag gestures and outside-click collapses keep working when the pointer
// exits widget bounds; everything else uses the hit-test result.
function pickMouseTarget(
  capture: InteractiveWidget | null,
  hit: InteractiveWidget | null,
  type: WidgetMouseEvent["type"],
): InteractiveWidget | null {
  if (capture && (type === "mouse_move" || type === "mouse_up")) return capture;
  return hit;
}

// --- Helpers ---

function isWidgetSource(value: unknown): value is WidgetSource {
  return (
    !!value &&
    typeof value === "object" &&
    "getWidgets" in value &&
    typeof (value as WidgetSource).getWidgets === "function"
  );
}

function decodeMouseFromCb(
  cb: number,
  x: number,
  y: number,
  isPress: boolean,
): WidgetMouseEvent {
  const isMotion = (cb & 32) !== 0;
  const isScroll = (cb & 64) !== 0;
  const button = cb & 3;
  const shift = !!(cb & 4);
  const ctrl = !!(cb & 16); // bit 16 = ctrl in xterm encoding

  if (isScroll) {
    const type = button === 0 ? "scroll_up" : "scroll_down";
    return { type, x, y, button: 0, shift, ctrl };
  }
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
      event: { key: name, character: "", shift, ctrl, meta },
    };
  }

  const name = CSI_LETTER_KEYS[final];
  if (!name) return { kind: "skip", bytes };

  // Special case: ESC[Z is shift+tab regardless of explicit modifier.
  if (final === "Z") {
    return {
      kind: "key",
      bytes,
      event: { key: "tab", character: "\t", shift: true, ctrl: false, meta: false },
    };
  }

  return {
    kind: "key",
    bytes,
    event: { key: name, character: "", shift, ctrl, meta },
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

