import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runInAction } from "mobx";
import { Segment } from "../../src/core/segment.js";
import type { RenderOptions } from "../../src/index.js";
import { WidgetBase } from "../../src/widgets/widget-base.js";
import { DefaultFocusManager } from "../../src/widgets/focus-manager.js";
import { EventRouter } from "../../src/widgets/event-router.js";
import { ESCAPE_DELAY_MS, InputParser, keyName, type ScreenMouseEvent } from "../../src/host/input.js";
import type { KeyEvent, WidgetMouseEvent, FrameSource } from "../../src/widgets/types.js";
import { parserFor } from "./feed.js";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// A widget that fills whatever rectangle the test places it in, one segment
// per cell, so `paint` can lay its stamped cells onto a frame one by one.
class StubWidget extends WidgetBase {
  keyEvents: KeyEvent[] = [];
  mouseEvents: WidgetMouseEvent[] = [];
  hoverChanges: boolean[] = [];
  rect: Rect = { x: 0, y: 0, width: 0, height: 0 };

  constructor(
    readonly id: string,
    readonly focusable: boolean = true,
  ) {
    super();
  }

  place(rect: Rect): void {
    this.rect = rect;
  }

  override setHovered(value: boolean): void {
    runInAction(() => {
      this.hovered = value;
    });
    this.hoverChanges.push(value);
  }

  override handleKey(event: KeyEvent): void {
    this.keyEvents.push(event);
  }

  override handleMouse(event: WidgetMouseEvent): void {
    this.mouseEvents.push(event);
  }

  protected draw(_options: RenderOptions): Iterable<Segment> {
    const { width, height } = this.rect;
    return Array.from({ length: height }, (_, row) => [
      ...(row > 0 ? [Segment.line()] : []),
      ...Array.from({ length: width }, () => new Segment("#")),
    ]).flat();
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: this.id.length, maximum: this.id.length };
  }
}

interface Harness {
  router: EventRouter;
  parser: InputParser;
  feed: (bytes: Uint8Array | string) => void;
  fm: DefaultFocusManager;
  widgets: StubWidget[];
  source: FrameSource;
  keyEvents: KeyEvent[];
  mouseEvents: ScreenMouseEvent[];
  setWidgets: (widgets: StubWidget[]) => void;
}

// The frame an app would paint: each widget's stamped cells at its rect, in
// list order, so a later widget paints over an earlier one.
function paint(widgets: readonly StubWidget[]): Segment[][] {
  const frame: Segment[][] = [];
  for (const w of widgets) {
    Segment.splitLines(w.render({ maxWidth: 80 })).forEach((line, row) => {
      const y = w.rect.y + row;
      while (frame.length <= y) frame.push([]);
      const cells = frame[y]!;
      line.forEach((cell, col) => {
        while (cells.length <= w.rect.x + col) cells.push(new Segment(" "));
        cells[w.rect.x + col] = cell;
      });
    });
  }
  return frame;
}

function makeHarness(initial: StubWidget[] = []): Harness {
  let widgets = initial;
  const fm = new DefaultFocusManager(() => widgets);
  fm.settle(widgets);

  const source: FrameSource = {
    focusManager: fm,
    get frame() {
      return paint(widgets);
    },
    refresh: () => {},
  };

  const router = new EventRouter({ source, focusOnClick: false });
  const parser = parserFor(router);

  const keyEvents: KeyEvent[] = [];
  const mouseEvents: ScreenMouseEvent[] = [];
  // High priority: this is an "observe every key" hook for assertions. If
  // it sat at normal priority, FocusManager's Tab handler would stop the
  // event first and the observer would miss Tab events. Note this also
  // runs ahead of any user-level high-priority handlers registered later
  // by individual tests — fine for the few tests that need it, since
  // those tests don't rely on the observer for their assertions.
  router.onKey((e) => keyEvents.push(e), { priority: "high" });
  router.onMouse((e) => mouseEvents.push(e));

  return {
    router,
    parser,
    feed: (bytes) => parser.feed(bytes),
    fm,
    widgets,
    source,
    keyEvents,
    mouseEvents,
    setWidgets: (next) => {
      widgets = next;
      fm.settle(widgets);
    },
  };
}

describe("EventRouter — key parsing", () => {
  let h: Harness;

  beforeEach(() => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    h = makeHarness([a, b]);
  });

  it("parses a printable character into a key event", () => {
    h.feed("x");
    expect(h.keyEvents).toMatchObject([
      { key: "x", character: "x", shift: false, ctrl: false, meta: false },
    ]);
  });

  it("dispatches printable keys to the focused widget", () => {
    h.feed("z");
    expect(h.widgets[0]!.keyEvents).toHaveLength(1);
    expect(h.widgets[0]!.keyEvents[0]!.character).toBe("z");
    expect(h.widgets[1]!.keyEvents).toHaveLength(0);
  });

  it("emits ctrl=true for control bytes", () => {
    h.feed("\x01"); // Ctrl+A
    expect(h.keyEvents[0]).toMatchObject({ key: "a", ctrl: true });
  });

  it("emits Ctrl+C as { key:'c', ctrl:true } without swallowing", () => {
    h.feed("\x03");
    expect(h.keyEvents[0]).toMatchObject({
      key: "c",
      character: "",
      ctrl: true,
      shift: false,
      meta: false,
    });
    // Caller (focused widget) still receives it — router does not exit.
    expect(h.widgets[0]!.keyEvents[0]).toMatchObject({ key: "c", ctrl: true });
  });

  it("recognises enter, tab, backspace, space", () => {
    h.feed("\r");
    h.feed("\n");
    h.feed("\t");
    h.feed("\x7f");
    h.feed(" ");
    expect(h.keyEvents.map((e) => e.key)).toEqual([
      "enter",
      "enter",
      "tab",
      "backspace",
      "space",
    ]);
  });

  it("recognises arrow keys via CSI", () => {
    h.feed("\x1b[A");
    h.feed("\x1b[B");
    h.feed("\x1b[C");
    h.feed("\x1b[D");
    expect(h.keyEvents.map((e) => e.key)).toEqual(["up", "down", "right", "left"]);
  });

  it("recognises home/end/pageup/pagedown/delete via CSI tilde", () => {
    h.feed("\x1b[1~");
    h.feed("\x1b[3~");
    h.feed("\x1b[4~");
    h.feed("\x1b[5~");
    h.feed("\x1b[6~");
    expect(h.keyEvents.map((e) => e.key)).toEqual([
      "home",
      "delete",
      "end",
      "pageup",
      "pagedown",
    ]);
  });

  it("recognises F1–F12", () => {
    h.feed("\x1bOP"); // F1 via SS3
    h.feed("\x1b[15~"); // F5
    h.feed("\x1b[24~"); // F12
    expect(h.keyEvents.map((e) => e.key)).toEqual(["f1", "f5", "f12"]);
  });

  it("emits Alt+letter for ESC + printable byte in a single chunk", () => {
    h.feed("\x1bb");
    expect(h.keyEvents).toMatchObject([
      { key: "b", character: "", shift: false, ctrl: false, meta: true },
    ]);
  });

  it("Alt+Backspace decodes ESC + 0x7f", () => {
    h.feed("\x1b\x7f");
    expect(h.keyEvents).toMatchObject([
      { key: "backspace", character: "", shift: false, ctrl: false, meta: true },
    ]);
  });

  it("Alt+Space uses the canonical 'space' key name (not literal ' ')", () => {
    // [LAW:one-source-of-truth] Named single-byte keys take their canonical
    // name on the Alt path too. A handler matching `event.key === "space"`
    // must catch both bare space and Alt+Space; the only difference is
    // event.meta.
    h.feed("\x1b ");
    expect(h.keyEvents).toMatchObject([
      { key: "space", character: "", shift: false, ctrl: false, meta: true },
    ]);
  });

  it("Alt+uppercase is keyed by its glyph, which carries shift", () => {
    h.feed("\x1bF");
    expect(h.keyEvents).toMatchObject([
      { key: "F", character: "", shift: false, ctrl: false, meta: true },
    ]);
  });

  it("treats lone ESC as the escape key (after flush)", () => {
    h.feed("\x1b");
    expect(h.keyEvents).toHaveLength(0); // deferred
    h.parser.flush();
    expect(h.keyEvents).toMatchObject([
      { key: "escape", character: "", shift: false, ctrl: false, meta: false },
    ]);
  });

  it("collapses ESC ESC into exactly one escape event (terminals that double-send)", () => {
    // Some terminals send the escape key as two consecutive ESC bytes. The
    // parser must consume both and emit ONE event, not two — otherwise the
    // user pressing Esc once gets handled twice.
    h.feed("\x1b\x1b");
    h.parser.flush(); // drain any deferred lone-ESC timer (defensive — should be empty)
    expect(h.keyEvents).toHaveLength(1);
    expect(h.keyEvents[0]).toMatchObject({
      key: "escape", character: "", shift: false, ctrl: false, meta: false,
    });
  });

  it("does not emit lone ESC when followed by a CSI sequence in a later chunk", () => {
    h.feed("\x1b");
    h.feed("[A");
    expect(h.keyEvents.map((e) => e.key)).toEqual(["up"]);
  });

  it("does not emit lone ESC when an SS3 sequence completes it in a later chunk", () => {
    h.feed("\x1b");
    h.feed("OP");
    expect(h.keyEvents.map((e) => e.key)).toEqual(["f1"]);
  });

  // A held ESC whose timer has not run yet when the next key lands — a busy
  // worker queues both messages first (rich-host-input-0c4f). Only `[` and `O`
  // continue a split sequence, so any other next chunk means Escape was its own key.
  it.each([
    ["a key that starts with ESC", "\x1b[B", ["escape", "down"]],
    ["a printable key", "G", ["escape", "g"]],
    ["a control key", "\t", ["escape", "tab"]],
  ])("emits a held ESC as escape before %s in the next chunk", (_name, next, keys) => {
    h.feed("\x1b");
    h.feed(next);
    expect(h.keyEvents.map((e) => e.key)).toEqual(keys);
    expect(h.keyEvents.every((e) => !e.meta)).toBe(true);
  });

  it("drains nothing after a held ESC whose Escape resets the parser", () => {
    const keys: string[] = [];
    const parser: InputParser = new InputParser({
      key: (press) => {
        keys.push(press.key);
        if (press.key === "escape") parser.reset();
      },
      mouse: () => {},
    }, "split");
    parser.feed("\x1b");
    parser.feed("a\x1b");
    parser.flush();
    expect(keys).toEqual(["escape"]);
  });

  it("drains the next chunk even when the held ESC's Escape throws", () => {
    const keys: string[] = [];
    const parser = new InputParser({
      key: (press) => {
        keys.push(press.key);
        if (press.key === "escape") throw new Error("handler");
      },
      mouse: () => {},
    }, "split");
    parser.feed("\x1b");
    expect(() => parser.feed("ab")).toThrow("handler");
    expect(keys).toEqual(["escape", "a", "b"]);
  });

  it("still reads Alt+key when ESC and the key arrive in one chunk", () => {
    h.feed("\x1bG");
    expect(h.keyEvents).toMatchObject([{ key: "G", meta: true }]);
  });

  it("handles a CSI sequence split across multiple chunks", () => {
    h.feed("\x1b[");
    h.feed("3");
    h.feed("~");
    expect(h.keyEvents.map((e) => e.key)).toEqual(["delete"]);
  });
});

// A real tty's reads can end inside a sequence, so an unfinished one is held
// for the escape delay: a rest that arrives within it completes the key, and
// one that has stalled by then is read as the keys it holds (rich-host-input-gnl7).
describe("InputParser on a split host", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function split(onKey: (key: string) => void = () => {}) {
    const keys: string[] = [];
    const parser = new InputParser({
      key: (press) => {
        keys.push(keyName(press));
        onKey(press.key);
      },
      mouse: () => {},
    }, "split");
    return { keys, parser };
  }

  it.each([["["], ["O"]])("reads a stalled ESC %s as its Alt chord, and the next key as itself", (glyph) => {
    const { keys, parser } = split();
    parser.feed("\x1b");
    parser.feed(glyph);
    vi.advanceTimersByTime(ESCAPE_DELAY_MS);
    parser.feed("q");
    expect(keys).toEqual([`meta+${glyph}`, "q"]);
  });

  it("completes a sequence whose rest arrives within the escape delay", () => {
    const { keys, parser } = split();
    parser.feed("\x1b[");
    vi.advanceTimersByTime(ESCAPE_DELAY_MS - 1);
    parser.feed("A");
    vi.advanceTimersByTime(ESCAPE_DELAY_MS);
    expect(keys).toEqual(["up"]);
  });

  it("reads a lone ESC as Escape once the escape delay passes", () => {
    const { keys, parser } = split();
    parser.feed("\x1b");
    vi.advanceTimersByTime(ESCAPE_DELAY_MS - 1);
    expect(keys).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(keys).toEqual(["escape"]);
  });

  it("holds a stalled tail left by a handler that threw", () => {
    const { keys, parser } = split((key) => {
      if (key === "a") throw new Error("handler");
    });
    expect(() => parser.feed("a\x1b[")).toThrow("handler");
    vi.advanceTimersByTime(ESCAPE_DELAY_MS);
    parser.feed("q");
    expect(keys).toEqual(["a", "meta+[", "q"]);
  });
});

// A host whose chunks end on key boundaries (xterm.js, and the docs worker's
// stdin) settles every chunk as it arrives: nothing is held for a timer that a
// busy worker would run too late (rich-host-input-ab9n).
describe("InputParser on a whole-keys host", () => {
  function wholeKeys(onKey: (key: string, parser: InputParser) => void = () => {}) {
    const keys: string[] = [];
    const parser: InputParser = new InputParser({
      key: (press) => {
        keys.push(keyName(press));
        onKey(press.key, parser);
      },
      mouse: () => {},
    }, "whole-keys");
    return { keys, parser };
  }

  it("reads a lone ESC chunk as Escape at once", () => {
    const { keys, parser } = wholeKeys();
    parser.feed("\x1b");
    expect(keys).toEqual(["escape"]);
  });

  it.each([["["], ["O"]])("reads Escape then %s as two keys, and the parser recovers", (next) => {
    const { keys, parser } = wholeKeys();
    parser.feed("\x1b");
    parser.feed(next);
    parser.feed("x");
    parser.feed("1");
    expect(keys).toEqual(["escape", next, "x", "1"]);
  });

  it.each([["["], ["O"]])("reads a whole ESC %s chunk as the Alt chord xterm.js sends it for", (glyph) => {
    const { keys, parser } = wholeKeys();
    parser.feed(`\x1b${glyph}`);
    parser.feed("x");
    expect(keys).toEqual([`meta+${glyph}`, "x"]);
  });

  it("re-reads an incomplete tail after Escape", () => {
    const { keys, parser } = wholeKeys();
    parser.feed("\x1b\x1b[");
    expect(keys).toEqual(["escape", "meta+["]);
  });

  it("settles the rest of the chunk when a handler throws on Escape", () => {
    const { keys, parser } = wholeKeys((key) => {
      if (key === "escape") throw new Error("handler");
    });
    expect(() => parser.feed("\x1b\x1b[")).toThrow("handler");
    parser.feed("q");
    expect(keys).toEqual(["escape", "meta+[", "q"]);
  });

  it("still reads whole sequences and Alt chords", () => {
    const { keys, parser } = wholeKeys();
    parser.feed("\x1b[A");
    parser.feed("\x1bOP");
    parser.feed("\x1bG");
    parser.feed("\x1b\x1b[A");
    expect(keys).toEqual(["up", "f1", "meta+G", "meta+up"]);
  });

  it.each([
    ["a\x1b[A", "q", ["a", "up", "q"]],
    ["ab\x1b", "q", ["a", "b", "escape", "q"]],
  ])("reads the rest of %j whole when a handler throws mid-chunk", (chunk, next, expected) => {
    const { keys, parser } = wholeKeys((key) => {
      if (key === "a") throw new Error("handler");
    });
    expect(() => parser.feed(chunk)).toThrow("handler");
    parser.feed(next);
    expect(keys).toEqual(expected);
  });

  it("stops settling when Escape resets the parser", () => {
    const { keys, parser } = wholeKeys((key, p) => {
      if (key === "escape") p.reset();
    });
    parser.feed("\x1b\x1b[");
    expect(keys).toEqual(["escape"]);
  });
});

describe("EventRouter — tab navigation", () => {
  it("tab calls focusManager.next()", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    const h = makeHarness([a, b]);
    expect(h.fm.current).toBe(a);
    h.feed("\t");
    expect(h.fm.current).toBe(b);
    h.feed("\t");
    expect(h.fm.current).toBe(a);
  });

  it("shift+tab (ESC[Z) calls focusManager.prev()", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    const c = new StubWidget("c");
    const h = makeHarness([a, b, c]);
    expect(h.fm.current).toBe(a);
    h.feed("\x1b[Z");
    expect(h.fm.current).toBe(c);
  });

  it("delivers tab to the focused widget; falls through to focus traversal when not stopped", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    const h = makeHarness([a, b]);
    h.feed("\t");
    // StubWidget.handleKey does not call event.stop() → FocusManager (registered
    // as a normal-priority chain handler) runs and moves focus.
    expect(a.keyEvents).toHaveLength(1);
    expect(a.keyEvents[0]!.key).toBe("tab");
    expect(h.fm.current).toBe(b);
  });

  it("a widget that stops the tab event prevents focus traversal", () => {
    class TabConsumer extends StubWidget {
      override handleKey(event: KeyEvent): void {
        this.keyEvents.push(event);
        if (event.key === "tab") event.stop();
      }
    }
    const a = new TabConsumer("a");
    const b = new StubWidget("b");
    const h = makeHarness([a, b]);
    h.feed("\t");
    expect(h.fm.current).toBe(a); // focus did not move
  });

  it("a high-priority handler runs before the focused widget and can stop the event", () => {
    const a = new StubWidget("a");
    const h = makeHarness([a]);
    let highSawIt = false;
    h.router.onKey(
      (event) => {
        if (event.key === "c" && event.ctrl) {
          highSawIt = true;
          event.stop();
        }
      },
      { priority: "high" },
    );
    h.feed("\x03"); // Ctrl+C
    expect(highSawIt).toBe(true);
    // Focused widget never saw it because the high handler stopped the event.
    expect(a.keyEvents.find((e) => e.ctrl && e.key === "c")).toBeUndefined();
  });

  it("normal-priority handlers run after the focused widget", () => {
    const order: string[] = [];
    class Observer extends StubWidget {
      override handleKey(event: KeyEvent): void {
        super.handleKey(event);
        order.push("widget");
      }
    }
    const observed = new Observer("o");
    const h = makeHarness([observed]);
    h.router.onKey(() => order.push("normal")); // default priority = "normal"
    h.feed("x");
    expect(order).toEqual(["widget", "normal"]);
  });
});

describe("EventRouter — mouse parsing", () => {
  it("parses SGR press / release", () => {
    const a = new StubWidget("a");
    a.place({ x: 0, y: 0, width: 10, height: 1 });
    const h = makeHarness([a]);
    h.feed("\x1b[<0;5;1M"); // press at col 5 (0-based: 4), row 1 (0-based: 0)
    h.feed("\x1b[<0;5;1m"); // release
    expect(h.mouseEvents).toEqual([
      { type: "mouse_down", x: 4, y: 0, button: 0, shift: false, ctrl: false },
      { type: "mouse_up", x: 4, y: 0, button: 0, shift: false, ctrl: false },
    ]);
  });

  it("parses SGR motion", () => {
    const a = new StubWidget("a");
    a.place({ x: 0, y: 0, width: 10, height: 1 });
    const h = makeHarness([a]);
    // cb=35 = 3 (release-any) + 32 (motion bit) = no-button motion
    h.feed("\x1b[<35;3;1M");
    expect(h.mouseEvents).toEqual([
      { type: "mouse_move", x: 2, y: 0, button: 3, shift: false, ctrl: false },
    ]);
  });

  it("parses SGR sideways scroll", () => {
    const h = makeHarness();
    h.feed("\x1b[<66;1;1M"); // scroll left
    h.feed("\x1b[<67;1;1M"); // scroll right
    expect(h.mouseEvents.map((e) => e.type)).toEqual(["scroll_left", "scroll_right"]);
  });

  it("parses X10 mouse fallback", () => {
    const h = makeHarness();
    // ESC [ M cb cx cy where each byte = value + 32 (1-based)
    // cb=32 (button 0 press), cx=33 (col 1), cy=33 (row 1) → x=0, y=0
    const buf = Buffer.from([0x1b, 0x5b, 0x4d, 32, 33, 33]);
    h.feed(buf);
    expect(h.mouseEvents).toEqual([
      { type: "mouse_down", x: 0, y: 0, button: 0, shift: false, ctrl: false },
    ]);
  });

  it("dispatches click to the topmost (last) widget under the pointer", () => {
    const lower = new StubWidget("lower");
    const upper = new StubWidget("upper");
    lower.place({ x: 0, y: 0, width: 10, height: 3 });
    upper.place({ x: 0, y: 0, width: 10, height: 3 });
    const h = makeHarness([lower, upper]);
    h.feed("\x1b[<0;3;2M");
    expect(upper.mouseEvents).toHaveLength(1);
    expect(lower.mouseEvents).toHaveLength(0);
  });

  it("delivers the event in the widget's own coordinates", () => {
    const a = new StubWidget("a");
    a.place({ x: 4, y: 2, width: 6, height: 3 });
    const h = makeHarness([a]);
    h.feed("\x1b[<0;7;4M"); // screen (6, 3)
    expect(a.mouseEvents).toEqual([
      { type: "mouse_down", x: 2, y: 1, button: 0, shift: false, ctrl: false, over: true },
    ]);
    // Handlers registered with onMouse still see the screen position.
    expect(h.mouseEvents[0]).toMatchObject({ x: 6, y: 3 });
  });
});

describe("EventRouter — drag capture", () => {
  it("mouse_move off the pressed widget still routes to it after mouse_down", () => {
    // A widget that captures the drag (slider, scrollbar, etc.) must keep
    // receiving mouse_move events even when the pointer leaves it.
    // Without capture, the move would dispatch to the topmost-hit widget at
    // the new position — breaking drag-to-scrub behavior.
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    a.place({ x: 0, y: 0, width: 5, height: 1 });
    b.place({ x: 5, y: 0, width: 5, height: 1 });
    const h = makeHarness([a, b]);

    // Press inside a.
    h.feed("\x1b[<0;1;1M");
    expect(a.mouseEvents.map((e) => e.type)).toEqual(["mouse_down"]);
    expect(b.mouseEvents).toHaveLength(0);

    // Move onto b — STILL routes to a because a captured the drag.
    h.feed("\x1b[<32;7;1M");
    expect(a.mouseEvents.map((e) => e.type)).toEqual(["mouse_down", "mouse_move"]);
    expect(b.mouseEvents.filter((e) => e.type === "mouse_move")).toHaveLength(0);

    // Release outside a — routes to a (captured), then capture clears.
    h.feed("\x1b[<0;7;1m");
    expect(a.mouseEvents.map((e) => e.type)).toEqual(["mouse_down", "mouse_move", "mouse_up"]);

    // A fresh move after release goes by hit-test again.
    h.feed("\x1b[<35;7;1M");
    expect(b.mouseEvents.some((e) => e.type === "mouse_move")).toBe(true);
  });

  it("a captured drag keeps the frame of reference its press found", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    a.place({ x: 3, y: 1, width: 5, height: 1 });
    b.place({ x: 8, y: 1, width: 5, height: 1 });
    const h = makeHarness([a, b]);

    h.feed("\x1b[<0;5;2M"); // press screen (4, 1) → a's column 1
    h.feed("\x1b[<32;11;3M"); // drag over b and a row down: (10, 2)
    h.feed("\x1b[<0;2;2m"); // release left of a: (1, 1)
    expect(a.mouseEvents.map(({ type, x, y }) => ({ type, x, y }))).toEqual([
      { type: "mouse_down", x: 1, y: 0 },
      { type: "mouse_move", x: 7, y: 1 },
      { type: "mouse_up", x: -2, y: 0 },
    ]);
  });

  it("a captured drag follows the widget to where it is painted now", () => {
    const a = new StubWidget("a");
    a.place({ x: 3, y: 1, width: 5, height: 1 });
    const h = makeHarness([a]);

    h.feed("\x1b[<0;5;2M"); // press screen (4, 1) → a's column 1
    a.place({ x: 6, y: 2, width: 5, height: 1 }); // repainted right and down
    h.feed("\x1b[<32;9;3M"); // (8, 2) → a's column 2 where it is now
    expect(a.mouseEvents.map(({ type, x, y }) => ({ type, x, y }))).toEqual([
      { type: "mouse_down", x: 1, y: 0 },
      { type: "mouse_move", x: 2, y: 0 },
    ]);
  });

  it("tells a captured widget whether the pointer is over it", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    a.place({ x: 0, y: 0, width: 5, height: 1 });
    b.place({ x: 5, y: 0, width: 5, height: 1 });
    const h = makeHarness([a, b]);

    h.feed("\x1b[<0;1;1M");
    h.feed("\x1b[<0;7;1m"); // released on b
    h.feed("\x1b[<0;1;1M");
    h.feed("\x1b[<0;3;1m"); // released on a
    expect(a.mouseEvents.map(({ type, over }) => ({ type, over }))).toEqual([
      { type: "mouse_down", over: true },
      { type: "mouse_up", over: false },
      { type: "mouse_down", over: true },
      { type: "mouse_up", over: true },
    ]);
  });

  it("the wheel reaches no widget, neither the one under it nor one holding a drag", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    a.place({ x: 0, y: 0, width: 5, height: 1 });
    b.place({ x: 5, y: 0, width: 5, height: 1 });
    const h = makeHarness([a, b]);

    h.feed("\x1b[<0;1;1M"); // a captures a drag
    h.feed("\x1b[<66;7;1M"); // the sideways wheel over b
    expect(a.mouseEvents.map((e) => e.type)).toEqual(["mouse_down"]);
    expect(b.mouseEvents).toEqual([]);
    expect(h.mouseEvents.map((e) => e.type)).toEqual(["mouse_down", "scroll_left"]);
  });
});

describe("EventRouter — hover dispatch", () => {
  it("sets hovered=true when the pointer moves onto a widget and false when it leaves", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    a.place({ x: 0, y: 0, width: 5, height: 1 });
    b.place({ x: 5, y: 0, width: 5, height: 1 });
    const h = makeHarness([a, b]);

    // Move into a — only a should change to hovered=true
    h.feed("\x1b[<35;2;1M");
    expect(a.hovered).toBe(true);
    expect(b.hovered).toBe(false);

    // Move from a into b — both change
    h.feed("\x1b[<35;7;1M");
    expect(a.hovered).toBe(false);
    expect(b.hovered).toBe(true);

    // Move outside both
    h.feed("\x1b[<35;20;1M");
    expect(a.hovered).toBe(false);
    expect(b.hovered).toBe(false);
  });

  it("reset() clears hover, since the router no longer knows where the pointer is", () => {
    const a = new StubWidget("a");
    a.place({ x: 0, y: 0, width: 5, height: 1 });
    const h = makeHarness([a]);
    h.feed("\x1b[<35;2;1M");
    expect(a.hovered).toBe(true);
    h.router.reset();
    expect(a.hovered).toBe(false);
  });

  it("does not call setHovered when state is unchanged", () => {
    const a = new StubWidget("a");
    a.place({ x: 0, y: 0, width: 10, height: 1 });
    const h = makeHarness([a]);

    h.feed("\x1b[<35;2;1M");
    h.feed("\x1b[<35;3;1M");
    h.feed("\x1b[<35;4;1M");
    // All three moves are inside a → only the first transition should record.
    expect(a.hoverChanges).toEqual([true]);
  });
});

describe("EventRouter — reset", () => {
  it("reset() clears drag capture so the next session hit-tests fresh", () => {
    // [LAW:one-source-of-truth] capturedWidget belongs to the current
    // session. Leaking it would misroute the first mouse_move after restart.
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    a.place({ x: 0, y: 0, width: 5, height: 1 });
    b.place({ x: 5, y: 0, width: 5, height: 1 });
    const h = makeHarness([a, b]);

    // mouse_down on a: opens drag capture.
    h.feed("\x1b[<0;1;1M");
    expect(a.mouseEvents.map((e) => e.type)).toEqual(["mouse_down"]);

    h.router.reset();
    a.mouseEvents.length = 0;
    b.mouseEvents.length = 0;

    // mouse_move over b. With capture cleared, the router
    // hit-tests fresh: b receives the mouse_move (as the topmost-hit
    // widget) and the hover loop flips b.hovered to true. The point of
    // this assertion is that `a` — which held capture in the previous
    // session — must NOT receive any mouse_move after restart.
    h.feed("\x1b[<32;7;1M");
    expect(a.mouseEvents.filter((e) => e.type === "mouse_move")).toHaveLength(0);
  });
});
